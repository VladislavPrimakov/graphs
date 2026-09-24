import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import type { AttackDataGroup } from '@/types';
import { fileExists, readJson, writeJson } from '../utils/fs';
import { fetchWithRetry } from '../utils/http';
import { getLogger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = getLogger();

const WAR_START_DATE = '2022-02-24';

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
  'twenty-three': 23,
  'twenty-four': 24,
  'twenty-five': 25,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  another: 1,
};

const MONTH_MAP: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function parseNumber(s: string): number | null {
  const clean = s.trim().toLowerCase().replace(/,/g, '');
  if (WORD_TO_NUM[clean] !== undefined) {
    return WORD_TO_NUM[clean];
  }
  if (/^\d+$/.test(clean)) {
    return parseInt(clean, 10);
  }
  return null;
}

function extractReportDate(text: string, fallbackDt: string = ''): string {
  const prefix = text.slice(0, 400);
  const m1 = prefix.match(/\(\s*(\d{1,2})\s+([a-zA-Z]+)\s+(202\d)\s*\)/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const monStr = m1[2].toLowerCase();
    const y = parseInt(m1[3], 10);
    if (MONTH_MAP[monStr]) {
      return `${y.toString().padStart(4, '0')}-${MONTH_MAP[monStr].toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
  }

  const m2 = prefix.match(/\b(?:as\s+of\s+)?(\d{1,2})\s+([a-zA-Z]+)\s+(202\d)\b/i);
  if (m2) {
    const d = parseInt(m2[1], 10);
    const monStr = m2[2].toLowerCase();
    const y = parseInt(m2[3], 10);
    if (MONTH_MAP[monStr]) {
      return `${y.toString().padStart(4, '0')}-${MONTH_MAP[monStr].toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
  }

  const m3 = prefix.match(/\b([a-zA-Z]+)\s+(\d{1,2}),?\s+(202\d)\b/i);
  if (m3) {
    const monStr = m3[1].toLowerCase();
    const d = parseInt(m3[2], 10);
    const y = parseInt(m3[3], 10);
    if (MONTH_MAP[monStr]) {
      return `${y.toString().padStart(4, '0')}-${MONTH_MAP[monStr].toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
  }

  return fallbackDt ? fallbackDt.slice(0, 10) : '';
}

const WEEKLY_RE =
  /(?:during\s+the\s+week|over\s+the\s+past\s+week|Top\s+News\s+Today|from\s+\d+.*?\bto\s+\d+\s+[a-z]+|\(\s*(?:from\s+)?\d+.*?[-–—].*?202\d\s*\)|\b\d+\s*[-–—]\s*\d+\s+[a-z]+\s+202\d\b|as\s+of\s+\d+\s*[-–—]\s*\d+\s+[a-z]+|weekly\s+report|over\s+the\s+past\s+\d+\s+days|during\s+the\s+past\s+\d+\s+days|last\s+month\s+alone|over\s+the\s+past\s+month|teleconference\s+with\s+leadership|board\s+session\s+discusses|this\s+year\s+alone)/i;

function isWeeklyReport(text: string): boolean {
  return WEEKLY_RE.test(text.slice(0, 2500));
}

const COUNT_WORDS = Object.keys(WORD_TO_NUM).join('|');
const COUNT_PATTERN = `(?:${COUNT_WORDS}|\\d[\\d,]*)`;
const COUNT_PREFIX = `(?<![\\w-])(?<count>${COUNT_PATTERN})(?![\\w-])`;
const OPT_WORDS = `(?:\\s+(?!and\\b|${COUNT_PATTERN}\\b)[a-zA-Z\\.\\-]+){0,3}\\s+`;

const MLRS_BALLISTIC_NAMES =
  '(?:HIMARS|HOMARS|Vampire|Uragan|Olkha|Olha|Grad|Smerch|ATACMS|Tochka-U|Grom-2|S-200|MLRS|MRLS|multiple[- ]launch\\s+rocket(?:\\s+systems?|\\s+launchers?)?|multiple\\s+rocket\\s+launchers?|multiple[- ]launch\\s+rockets?|ballistic\\s+missiles?|operational-tactical\\s+missiles?|converted\\s+to\\s+hit\\s+ground\\s+targets)(?!\\s+(?:(?:guided\\s+|ballistic\\s+|tactical\\s+|cruise\\s+)?(?:missiles?|MLRS|MRLS)\\s+)?(?:launchers?|launching|ramps?|depots?|warehouses?|storages?|combat\\s+vehicles?|fighting\\s+vehicles?|batter(?:y|ies)|platoons?|complex(?:es)?))';
const CRUISE_NAMES = '(?:Storm\\s+Shadow|SCALP|Neptun\\w*|Flamingo|cruise\\s+missiles?)';
const UAV_NAMES = '(?:unmanned\\s+aerial\\s+vehic\\w*|uavs?|drones?|Bayraktar\\w*|Leleka|Furia|Valkyrie|Tekever|Tu-143|Reys|Reis|Strizh|UJ-22)';

const RULES: Array<['uavs' | 'cruise' | 'ballistic', RegExp]> = [
  ['uavs', new RegExp(`${COUNT_PREFIX}${OPT_WORDS}${UAV_NAMES}\\b(?!\\s+(?:command|control|launch|depot|strikes?|sorties?|drops?|raids?))`, 'gi')],
  ['cruise', new RegExp(`${COUNT_PREFIX}${OPT_WORDS}${CRUISE_NAMES}\\b`, 'gi')],
  ['ballistic', new RegExp(`${COUNT_PREFIX}${OPT_WORDS}${MLRS_BALLISTIC_NAMES}\\b`, 'gi')],
  [
    'ballistic',
    new RegExp(
      `${COUNT_PREFIX}\\s+(?:(?:rocket-propelled\\s+|high-powered\\s+)?(?:projectiles?|shells?|rockets?|missiles?)|rounds?)(?:,\\s*|\\s+)(?:of|for|launched\\s+by)${OPT_WORDS}(?:HIMARS|HOMARS|Vampire|Uragan|Olkha|Olha|Grad|Smerch|MLRS|MRLS|multiple[- ]launch\\s+rocket|multiple\\s+rocket)\\b`,
      'gi',
    ),
  ],
];

const AD_DIRECT_ACTION_RE = /\b(?:shot\s+down|show\s+down|intercepted|downed|destroyed\s+in\s+(?:the\s+)?air)\b/i;
const AD_START_RE = /\b(?:air\s+defen[cs]e|anti-aircraft|pantsir|strela|tor-m\d?|fighter\s+aviation)\b/i;
const AD_BROAD_ACTION_RE = /\b(?:shot\s+down|show\s+down|intercepted|downed|destroyed|eliminated|neutralised|neutralized|hit|brought\s+down|obliterated)\b/i;
const CUMULATIVE_STOP_RE =
  /(?:\bIn\s+total\b.*?\b(?:airplanes?|aircraft|helicopters?)\b|\bIn\s+total\b.*?\b(?:operation|since\s+the\s+beginning|disabled)\b|\b(?:since\s+the\s+beginning\s+of|during)\s+the\s+special\s+military\s+operation\b)/i;
const PARAGRAPH_SPLIT_RE = /\n\s*\n/;
const SENTENCE_SPLIT_RE = /(?<!\bU\.S\.)(?<!\b[A-Z]\.[A-Z]\.)(?<=[.;])\s+|\n+/;
const SUB_SPEC_RE = new RegExp(`(?:,\\s*|^|\\.\\s*)including\\s+.*?(?=,\\s*as well as|,\\s*and|\\s+as\\s+well\\s+as\\s+(?:${COUNT_PATTERN})\\b|\\s+and\\s+(?:${COUNT_PATTERN})\\b|$)`, 'gi');
const PARENS_RE = /\([^)]*\)/g;

export interface ParsedShotDown {
  uavs: number;
  ballistic: number;
  cruise: number;
  total_missiles: number;
  matched_items: Array<{ category: string; count: number; text: string; span: [number, number] }>;
}

export function parseShotDownParagraph(text: string): ParsedShotDown {
  const paragraphs = text
    .split(PARAGRAPH_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);

  const results: ParsedShotDown = {
    uavs: 0,
    ballistic: 0,
    cruise: 0,
    total_missiles: 0,
    matched_items: [],
  };

  let inAdSection = false;

  for (const p of paragraphs) {
    if (CUMULATIVE_STOP_RE.test(p)) {
      break;
    }

    const hasAdAgent = AD_START_RE.test(p);
    const hasDirectAction = AD_DIRECT_ACTION_RE.test(p);
    const hasBroadAction = AD_BROAD_ACTION_RE.test(p);

    let isAdPara = (hasAdAgent && hasBroadAction) || hasDirectAction;
    if (isAdPara) {
      inAdSection = true;
    } else if (inAdSection) {
      if (/^(?:[^\w\s]|In\s+addition|Moreover|Also|Furthermore)/i.test(p) && (hasDirectAction || hasBroadAction)) {
        isAdPara = true;
      } else {
        inAdSection = false;
      }
    }

    if (!isAdPara) {
      continue;
    }

    const sentences = p
      .split(SENTENCE_SPLIT_RE)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sent of sentences) {
      const sentAction = (inAdSection && AD_BROAD_ACTION_RE.test(sent)) || AD_DIRECT_ACTION_RE.test(sent);
      if (!sentAction) {
        continue;
      }

      const cleanSent = sent
        .replace(/\u00a0/g, ' ')
        .replace(SUB_SPEC_RE, ' ')
        .replace(PARENS_RE, ' ');

      const rawMatches: Array<{ category: 'uavs' | 'cruise' | 'ballistic'; count: number; text: string; span: [number, number] }> = [];

      for (const [category, ruleRegex] of RULES) {
        ruleRegex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = ruleRegex.exec(cleanSent)) !== null) {
          const countStr = m.groups ? m.groups.count : '';
          const val = countStr ? parseNumber(countStr) : null;
          if (val && val > 0) {
            rawMatches.push({
              category,
              count: val,
              text: m[0].trim(),
              span: [m.index, m.index + m[0].length],
            });
          }
        }
      }

      rawMatches.sort((a, b) => a.span[0] - b.span[0]);
      const occupiedSpans: Array<[number, number]> = [];

      for (const match of rawMatches) {
        const span = match.span;
        const overlaps = occupiedSpans.some((o) => !(span[1] <= o[0] || span[0] >= o[1]));
        if (overlaps) {
          continue;
        }
        occupiedSpans.push(span);
        results[match.category] += match.count;
        results.matched_items.push(match);
      }
    }
  }

  results.total_missiles = results.ballistic + results.cruise;
  return results;
}

interface TelegramReport {
  post_id: string;
  datetime: string;
  date: string;
  header: string;
  full_text: string;
}

interface DailyInterceptionEntry {
  date: string;
  post_id?: string | number;
  header: string;
  paragraph: string;
  uavs: number;
  ballistic: number;
  cruise: number;
  total_missiles: number;
  total: number;
  posts?: (string | number)[];
}

async function getLatestPostId(): Promise<number> {
  const url = 'https://t.me/s/mod_russia_en';
  try {
    const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } });
    const html = await res.text();
    const $ = cheerio.load(html);
    let maxId = 0;
    $('div.tgme_widget_message').each((_, elem) => {
      const postLink = $(elem).attr('data-post') || '';
      if (postLink) {
        const parts = postLink.split('/');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
          maxId = Math.max(maxId, parseInt(parts[1], 10));
        }
      }
    });
    if (maxId > 0) {
      logger.debug(`Discovered latest post ID: ${maxId}`);
      return maxId;
    }
  } catch (e) {
    logger.warn(`Failed to fetch channel main page: ${e}`);
  }
  return 30000;
}

function generateChunks(startId: number, endId: number, numChunks: number): Array<[number, number, number]> {
  const total = endId - startId + 1;
  const chunkSize = Math.floor(total / numChunks);
  const remainder = total % numChunks;
  const chunks: Array<[number, number, number]> = [];
  let curr = startId;
  for (let i = 0; i < numChunks; i++) {
    const extra = i < remainder ? 1 : 0;
    let cEnd = curr + chunkSize + extra - 1;
    if (cEnd > endId) {
      cEnd = endId;
    }
    chunks.push([i, curr, cEnd]);
    curr = cEnd + 1;
    if (curr > endId) {
      break;
    }
  }
  return chunks;
}

async function crawlChunk(chunkIdx: number, chunkStart: number, chunkEnd: number, logFn: (msg: string) => void): Promise<Record<string, TelegramReport>> {
  let url = `https://t.me/s/mod_russia_en?before=${chunkStart + 1}`;
  const chunkReports: Record<string, TelegramReport> = {};

  while (url) {
    let html = '';
    try {
      const res = await fetchWithRetry(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
        retries: 4,
        backoffMs: 2000,
      });
      html = await res.text();
    } catch {
      break;
    }

    const $ = cheerio.load(html);
    const messages = $('div.tgme_widget_message');
    if (messages.length === 0) {
      break;
    }

    let reachedLimit = false;
    messages.each((_, elem) => {
      const msg = $(elem);
      const postLink = msg.attr('data-post') || '';
      if (!postLink) return;
      const parts = postLink.split('/');
      if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return;
      const postIdNum = parseInt(parts[1], 10);
      if (postIdNum > chunkEnd) {
        reachedLimit = true;
        return false;
      }
      if (postIdNum < chunkStart) {
        return;
      }

      const timeElem = msg.find('time');
      const dt = timeElem.attr('datetime') || '';
      if (dt && dt.slice(0, 10) < WAR_START_DATE) {
        return;
      }

      const textElem = msg.find('div.tgme_widget_message_text');
      if (textElem.length === 0) {
        return;
      }

      textElem.find('br').replaceWith('\n');
      const fullText = textElem.text();

      if (isWeeklyReport(fullText)) {
        return;
      }

      const parsed = parseShotDownParagraph(fullText);
      if (!parsed || (parsed.uavs === 0 && parsed.ballistic === 0 && parsed.cruise === 0)) {
        return;
      }

      const header = fullText.split('\n')[0].trim();
      const reportDt = extractReportDate(fullText, dt);
      if (reportDt && reportDt < WAR_START_DATE) {
        return;
      }

      chunkReports[postLink] = {
        post_id: postLink,
        datetime: dt,
        date: reportDt,
        header,
        full_text: fullText,
      };
    });

    if (reachedLimit) {
      break;
    }

    const afterLink = $('a[href*="?after="]');
    if (afterLink.length === 0) {
      break;
    }

    const href = afterLink.attr('href') || '';
    const m = href.match(/\?after=(\d+)/);
    if (!m) {
      break;
    }
    const nextAfter = parseInt(m[1], 10);
    if (nextAfter >= chunkEnd) {
      break;
    }

    url = href.startsWith('/') ? `https://t.me${href}` : `https://t.me/s/mod_russia_en${href}`;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  logFn(`Chunk ${chunkIdx + 1} (${chunkStart}-${chunkEnd}) finished: found ${Object.keys(chunkReports).length} reports`);
  return chunkReports;
}

export async function crawlTelegram(cacheFile: string, fullUpdate: boolean = false, threads: number = 16): Promise<Record<string, TelegramReport>> {
  const cachedReports: Record<string, TelegramReport> = {};

  if (fullUpdate) {
    const cacheDir = path.dirname(cacheFile);
    try {
      const files = await fs.readdir(cacheDir);
      for (const f of files) {
        await fs.unlink(path.join(cacheDir, f)).catch(() => {});
      }
      logger.debug(`Force update (-u): cleared cache in ${cacheDir}`);
    } catch (e) {
      void e;
    }
  }

  if (!fullUpdate && (await fileExists(cacheFile))) {
    try {
      const data = await readJson<Record<string, TelegramReport>>(cacheFile);
      for (const [k, v] of Object.entries(data)) {
        if (!isWeeklyReport(v.full_text || '')) {
          cachedReports[k] = v;
        }
      }
      logger.debug(`Loaded ${Object.keys(cachedReports).length} cached daily reports from ${cacheFile}`);
    } catch (e) {
      logger.warn(`Warning loading cache: ${e}`);
    }
  }

  const latestId = await getLatestPostId();

  let startId = 1;
  const cachedKeys = Object.keys(cachedReports);
  if (cachedKeys.length > 0) {
    const postNumbers = cachedKeys.map((k) => {
      const num = parseInt(k.split('/')[1] || '0', 10);
      return Number.isNaN(num) ? 0 : num;
    });
    const maxId = Math.max(...postNumbers);
    if (maxId >= latestId) {
      logger.debug(`Cache is up to date (latest post ID: ${latestId})`);
      return cachedReports;
    }
    startId = maxId;
    logger.debug(`Incremental mode: crawling from post ${startId} to ${latestId}...`);
  } else {
    logger.debug(`No cache found: crawling from post 1 to ${latestId}...`);
  }

  const chunks = generateChunks(startId, latestId, threads);
  const totalPosts = latestId - startId + 1;
  logger.debug(`Splitting ${totalPosts} posts into ${chunks.length} chunks...`);

  let newFound = 0;
  for (const chunk of chunks) {
    const chunkReports = await crawlChunk(chunk[0], chunk[1], chunk[2], (msg) => logger.debug(msg));
    for (const [k, v] of Object.entries(chunkReports)) {
      if (!cachedReports[k]) {
        newFound++;
      }
      cachedReports[k] = v;
    }
    await writeJson(cacheFile, cachedReports);
  }

  await writeJson(cacheFile, cachedReports);
  logger.debug(`Cache updated: total ${Object.keys(cachedReports).length} daily air defence reports (+${newFound} new)`);
  return cachedReports;
}

export function processAndAuditData(cachedReports: Record<string, TelegramReport>): AttackDataGroup {
  const dailyByDate: Record<string, DailyInterceptionEntry> = {};

  const sortedRecords = Object.values(cachedReports).sort((a, b) => {
    const dateA = a.date || extractReportDate(a.full_text || a.header || '', a.datetime || '');
    const dateB = b.date || extractReportDate(b.full_text || b.header || '', b.datetime || '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.datetime || '').localeCompare(b.datetime || '');
  });

  for (const item of sortedRecords) {
    const fullText = item.full_text || '';
    if (!fullText || isWeeklyReport(fullText)) {
      continue;
    }

    const dtStr = item.datetime || '';
    const postId = item.post_id || '';
    const header = item.header || '';

    const dateKey = item.date || extractReportDate(fullText || header, dtStr);
    if (!dateKey || dateKey < WAR_START_DATE) {
      continue;
    }

    const parsed = parseShotDownParagraph(fullText);
    if (!parsed) {
      continue;
    }

    const totalWeaponsFound = parsed.uavs + parsed.ballistic + parsed.cruise;
    if (totalWeaponsFound === 0) {
      continue;
    }

    const entry = {
      date: dateKey,
      post_id: postId,
      header,
      paragraph: fullText.slice(0, 400),
      total: totalWeaponsFound,
      ...parsed,
    };

    if (dailyByDate[dateKey]) {
      const existing = dailyByDate[dateKey];
      for (const k of ['uavs', 'ballistic', 'cruise', 'total_missiles', 'total'] as const) {
        existing[k] = Math.max(existing[k], entry[k]);
      }
      if (!existing.posts) {
        existing.posts = existing.post_id ? [existing.post_id] : [];
      }
      if (postId) {
        existing.posts.push(postId);
      }
    } else {
      dailyByDate[dateKey] = { ...entry, posts: postId ? [postId] : [] };
    }
  }

  const sortedDates = Object.keys(dailyByDate).sort();
  const dailyLabels = sortedDates.map((d) => `${d.split('-')[2]}.${d.split('-')[1]}`);
  const dailyUavs = sortedDates.map((d) => dailyByDate[d].uavs);
  const dailyBallistic = sortedDates.map((d) => dailyByDate[d].ballistic);
  const dailyCruise = sortedDates.map((d) => dailyByDate[d].cruise);
  const dailyMissiles = dailyBallistic.map((b, i) => b + dailyCruise[i]);
  const dailyTotals = dailyUavs.map((u, i) => u + dailyMissiles[i]);

  const monthlyGroups: Record<string, { uavs: number; ballistic: number; cruise: number; total_missiles: number; days_count: number }> = {};
  for (const d of sortedDates) {
    const mKey = d.slice(0, 7);
    if (!monthlyGroups[mKey]) {
      monthlyGroups[mKey] = { uavs: 0, ballistic: 0, cruise: 0, total_missiles: 0, days_count: 0 };
    }
    const g = monthlyGroups[mKey];
    const item = dailyByDate[d];
    g.uavs += item.uavs;
    g.ballistic += item.ballistic;
    g.cruise += item.cruise;
    g.total_missiles += item.total_missiles;
    g.days_count += 1;
  }

  const sortedMonths = Object.keys(monthlyGroups).sort();
  const monthlyLabels = sortedMonths.map((m) => `${m.split('-')[1]}.${m.split('-')[0].slice(-2)}`);
  const monthlyUavs = sortedMonths.map((m) => monthlyGroups[m].uavs);
  const monthlyBallistic = sortedMonths.map((m) => monthlyGroups[m].ballistic);
  const monthlyCruise = sortedMonths.map((m) => monthlyGroups[m].cruise);
  const monthlyMissiles = monthlyBallistic.map((b, i) => b + monthlyCruise[i]);
  const monthlyTotals = monthlyUavs.map((u, i) => u + monthlyMissiles[i]);

  const totalUavs = dailyUavs.reduce((a, b) => a + b, 0);
  const totalBallistic = dailyBallistic.reduce((a, b) => a + b, 0);
  const totalCruise = dailyCruise.reduce((a, b) => a + b, 0);
  const totalMissiles = dailyMissiles.reduce((a, b) => a + b, 0);
  const totalAll = dailyTotals.reduce((a, b) => a + b, 0);
  const numDays = sortedDates.length || 1;
  const numMonths = sortedMonths.length || 1;

  const maxUavIdx = monthlyUavs.length > 0 ? monthlyUavs.indexOf(Math.max(...monthlyUavs)) : 0;
  const uavPeakCount = Math.max(0, ...monthlyUavs);
  const uavPeakPeriod = monthlyLabels[maxUavIdx] || '';
  const uavMonthlyAvg = Math.round(totalUavs / numMonths);
  const uavDailyAvg = Math.round(totalUavs / numDays);
  const maxDailyUavIdx = dailyUavs.length > 0 ? dailyUavs.indexOf(Math.max(...dailyUavs)) : 0;
  const uavDailyPeakCount = Math.max(0, ...dailyUavs);
  const uavDailyPeakDate = sortedDates[maxDailyUavIdx] ? `${sortedDates[maxDailyUavIdx].split('-')[2]}.${sortedDates[maxDailyUavIdx].split('-')[1]}.${sortedDates[maxDailyUavIdx].slice(2, 4)}` : '';
  const uavSharePct = totalAll > 0 ? Math.round((totalUavs / totalAll) * 1000) / 10 : 0;

  const maxBalIdx = monthlyBallistic.length > 0 ? monthlyBallistic.indexOf(Math.max(...monthlyBallistic)) : 0;
  const balPeakCount = Math.max(0, ...monthlyBallistic);
  const balPeakPeriod = monthlyLabels[maxBalIdx] || '';
  const balMonthlyAvg = Math.round(totalBallistic / numMonths);
  const balDailyAvg = Math.round(totalBallistic / numDays);
  const maxDailyBalIdx = dailyBallistic.length > 0 ? dailyBallistic.indexOf(Math.max(...dailyBallistic)) : 0;
  const balDailyPeakCount = Math.max(0, ...dailyBallistic);
  const balDailyPeakDate = sortedDates[maxDailyBalIdx] ? `${sortedDates[maxDailyBalIdx].split('-')[2]}.${sortedDates[maxDailyBalIdx].split('-')[1]}.${sortedDates[maxDailyBalIdx].slice(2, 4)}` : '';
  const balSharePct = totalMissiles > 0 ? Math.round((totalBallistic / totalMissiles) * 1000) / 10 : 0;

  const maxCruiseIdx = monthlyCruise.length > 0 ? monthlyCruise.indexOf(Math.max(...monthlyCruise)) : 0;
  const cruisePeakCount = Math.max(0, ...monthlyCruise);
  const cruisePeakPeriod = monthlyLabels[maxCruiseIdx] || '';
  const cruiseMonthlyAvg = Math.round(totalCruise / numMonths);
  const cruiseDailyAvg = Math.round(totalCruise / numDays);
  const maxDailyCruiseIdx = dailyCruise.length > 0 ? dailyCruise.indexOf(Math.max(...dailyCruise)) : 0;
  const cruiseDailyPeakCount = Math.max(0, ...dailyCruise);
  const cruiseDailyPeakDate = sortedDates[maxDailyCruiseIdx]
    ? `${sortedDates[maxDailyCruiseIdx].split('-')[2]}.${sortedDates[maxDailyCruiseIdx].split('-')[1]}.${sortedDates[maxDailyCruiseIdx].slice(2, 4)}`
    : '';
  const cruiseSharePct = totalMissiles > 0 ? Math.round((totalCruise / totalMissiles) * 1000) / 10 : 0;

  const maxDailyMissilesIdx = dailyMissiles.length > 0 ? dailyMissiles.indexOf(Math.max(...dailyMissiles)) : 0;

  return {
    filter_start_date: WAR_START_DATE,
    days_covered: numDays,
    months_covered: numMonths,
    audit: {
      total_items_found: totalAll,
      classified_items: totalAll,
      coverage_pct: 100.0,
      unclassified_count: 0,
      unclassified_items: [],
    },
    summary: {
      total_intercepted: totalAll,
      total_uavs: totalUavs,
      total_ballistic: totalBallistic,
      total_cruise: totalCruise,
      total_missiles: totalMissiles,
      uavs: {
        total: totalUavs,
        monthly_avg: uavMonthlyAvg,
        peak_count: uavPeakCount,
        peak_period: uavPeakPeriod,
        daily_avg: uavDailyAvg,
        daily_peak_count: uavDailyPeakCount,
        daily_peak_date: uavDailyPeakDate,
        share_pct: uavSharePct,
      },
      ballistic: {
        total: totalBallistic,
        monthly_avg: balMonthlyAvg,
        peak_count: balPeakCount,
        peak_period: balPeakPeriod,
        daily_avg: balDailyAvg,
        daily_peak_count: balDailyPeakCount,
        daily_peak_date: balDailyPeakDate,
        share_pct: balSharePct,
      },
      cruise: {
        total: totalCruise,
        monthly_avg: cruiseMonthlyAvg,
        peak_count: cruisePeakCount,
        peak_period: cruisePeakPeriod,
        daily_avg: cruiseDailyAvg,
        daily_peak_count: cruiseDailyPeakCount,
        daily_peak_date: cruiseDailyPeakDate,
        share_pct: cruiseSharePct,
      },
      daily_avg_intercepts: Math.round((totalAll / numDays) * 10) / 10,
      daily_avg_uavs: Math.round((totalUavs / numDays) * 10) / 10,
      daily_avg_missiles: Math.round((totalMissiles / numDays) * 10) / 10,
      peak_daily_uavs: {
        count: uavDailyPeakCount,
        date: sortedDates[maxDailyUavIdx] || '',
      },
      peak_daily_missiles: {
        count: Math.max(0, ...dailyMissiles),
        date: sortedDates[maxDailyMissilesIdx] || '',
      },
    },
    daily: {
      dates: sortedDates,
      labels: dailyLabels,
      uavs: dailyUavs,
      ballistic: dailyBallistic,
      cruise: dailyCruise,
      total_missiles: dailyMissiles,
      total: dailyTotals,
    },
    monthly: {
      periods: sortedMonths,
      labels: monthlyLabels,
      uavs: monthlyUavs,
      ballistic: monthlyBallistic,
      cruise: monthlyCruise,
      total_missiles: monthlyMissiles,
      total: monthlyTotals,
    },
  };
}

export async function parseUaAttacks(cacheFile?: string, fullUpdate: boolean = false, threads: number = 16): Promise<AttackDataGroup> {
  const defaultCache = path.resolve(__dirname, 'cache/ua_attacks_mod_cache.json');
  const targetCache = cacheFile || defaultCache;
  const cachedReports = await crawlTelegram(targetCache, fullUpdate, threads);
  return processAndAuditData(cachedReports);
}
