import path from 'node:path';
import { WAR_LOSS_CATEGORIES, type WarLossCategory } from '@graphs/types/war-rf-ua/categories';
import type { LossCategoryChartData, LossCategoryItem, LossSummaryData } from '@graphs/types/war-rf-ua/category-losses';
import type { LossCategoryDetailData, LossEquipmentModel } from '@graphs/types/war-rf-ua/equipment-breakdown';
import type { LossesMapSectionData, LossMapPoint } from '@graphs/types/war-rf-ua/losses-map';
import type { LossOverallTimelineData, LossTimelineBreakdownItem } from '@graphs/types/war-rf-ua/losses-timeline';
import { XMLParser } from 'fast-xml-parser';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchWithRetry } from '@/utils/http';
import { getLogger } from '@/utils/logger';
import { ratio } from '@/utils/math';
import { PIPELINES_SRC_DIR } from '@/utils/paths';

export interface ParsedLossesResult {
  summary: LossSummaryData;
  periods: string[];
  overallTimeline: LossOverallTimelineData;
  categoryChart: LossCategoryChartData;
  byCategory: Record<WarLossCategory, LossCategoryDetailData>;
  map: LossesMapSectionData;
}

const DATA_FILE = path.resolve(PIPELINES_SRC_DIR, 'war-rf-ua/data-losses.json');
const CLASSIFICATION_FILE = path.resolve(PIPELINES_SRC_DIR, 'war-rf-ua/classification.json');

const GOOGLE_MAPS_KML_URL = 'https://www.google.com/maps/d/kml?mid=1dRn8TRMDLRkaaIBJad0YZvTt3dmiuxo&forcekml=1';

type ClassificationRules = Record<string, Record<string, string[]>>;

interface RawPlacemark {
  name: string;
  side: 'RF' | 'UA' | 'UNK';
  date?: string;
  nazva?: string;
  lng?: number;
  lat?: number;
  posts?: number[];
  sources?: string[];
}

interface WarLossesPipelineCache {
  meta?: {
    lastUpdated?: string;
    totalPlacemarks?: number;
  };
  placemarks: RawPlacemark[];
}

interface ParsedRecord {
  name: string;
  category: WarLossCategory;
  side: 'RF' | 'UA' | 'UNK';
  period: string | null;
  hasDate: boolean;
  rawDate: string;
  lng?: number;
  lat?: number;
  posts: number[];
  sources: string[];
}

/** Fetches latest KML map XML text from Google My Maps directly in memory without disk writes. */
async function fetchKmlText(): Promise<string> {
  const logger = getLogger();
  logger.debug('Downloading fresh KML from Google My Maps into memory...');
  const res = await fetchWithRetry(GOOGLE_MAPS_KML_URL, { retries: 2, timeoutMs: 45000 });
  if (!res.ok) {
    throw new Error(`Google Maps KML fetch returned HTTP ${res.status}`);
  }
  return await res.text();
}

/** Normalizes raw placemark title string. */
function cleanName(name: string): string {
  if (!name) return '';
  let n = name.toLowerCase().replace(/[\u00a0\u202f]/g, ' ');
  n = n.replace(/["«»'„“”]/g, '');
  n = n.replace(/^(?:поражение|уничтожение|подбитый|захваченный|брошенный|поражеение)\s+/i, '');
  n = n.replace(/\s*№?\s*(?:rf|ra|рф|ра|rа)[-\s]*\d+/g, '');
  n = n.replace(/\s+/g, ' ');
  return n.trim();
}

/** Pre-builds an inverted hash map from clean raw name to category and canonical English model. */
function buildClassificationLookup(rules: ClassificationRules): Map<string, { category: WarLossCategory; modelEn: string }> {
  const lookup = new Map<string, { category: WarLossCategory; modelEn: string }>();
  for (const [category, models] of Object.entries(rules)) {
    for (const [modelEn, raws] of Object.entries(models)) {
      for (const raw of raws) {
        lookup.set(cleanName(raw), { category: category as WarLossCategory, modelEn });
      }
    }
  }
  return lookup;
}

const START_DATE = '2022-02-01';
const START_PERIOD = '2022-02';
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const CURRENT_PERIOD = TODAY_ISO.slice(0, 7);

const RU_MONTHS: Record<string, string> = {
  январ: '01',
  феврал: '02',
  март: '03',
  апрел: '04',
  май: '05',
  мая: '05',
  июн: '06',
  июл: '07',
  август: '08',
  сентябр: '09',
  октябр: '10',
  ноябр: '11',
  декабр: '12',
};

const SEASONS: Record<string, string> = {
  зим: '01',
  весн: '04',
  лет: '07',
  осен: '10',
};

/** Parses dates formatted as DD.MM.YYYY, DD.MM.YY, MM.YYYY, MM.YY, seasons, slash dates, or month names into YYYY-MM and formatted string. */
function parseDate(dateStr?: string): { period: string | null; formatted: string } {
  if (!dateStr) return { period: null, formatted: '' };
  let s = dateStr.trim();

  s = s
    .replace(/^[.\s]+/, '')
    .replace(/[,;]/g, '.')
    .replace(/\.{2,}/g, '.');
  s = s.replace(/^(\d{1,2})\s+(\d{1,2})\.(\d{2,4})/, '$1.$2.$3');
  s = s.replace(/^(\d{1,2})\.(\d{1,2})\s+(\d{2,4})/, '$1.$2.$3');
  s = s.replace(/^(\d{1,2})-\d{1,2}\./, '$1.');

  const m1 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\b|$)/);
  if (m1) {
    const [, day, month, year] = m1;
    const yNum = Number(year);
    const mNum = Number(month);
    const dNum = Number(day);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const mm = month.padStart(2, '0');
      const dd = day.padStart(2, '0');
      const formatted = `${year}-${mm}-${dd}`;
      if (formatted >= START_DATE && formatted <= TODAY_ISO) {
        return { period: `${year}-${mm}`, formatted };
      }
    }
  }

  const m2 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})(?:\b|$)/);
  if (m2) {
    const [, day, month, shortYear] = m2;
    const year = `20${shortYear}`;
    const yNum = Number(year);
    const mNum = Number(month);
    const dNum = Number(day);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const mm = month.padStart(2, '0');
      const dd = day.padStart(2, '0');
      const formatted = `${year}-${mm}-${dd}`;
      if (formatted >= START_DATE && formatted <= TODAY_ISO) {
        return { period: `${year}-${mm}`, formatted };
      }
    }
  }

  const m3 = s.match(/^(\d{1,2})[./](\d{4})(?:\b|$)/);
  if (m3) {
    const [, month, year] = m3;
    const yNum = Number(year);
    const mNum = Number(month);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12) {
      const mm = month.padStart(2, '0');
      const period = `${year}-${mm}`;
      if (period >= START_PERIOD && period <= CURRENT_PERIOD) {
        return { period, formatted: `${year}-${mm}-01` };
      }
    }
  }

  const m4 = s.match(/^(\d{1,2})[./](\d{2})(?:\b|$)/);
  if (m4) {
    const [, month, shortYear] = m4;
    const year = `20${shortYear}`;
    const yNum = Number(year);
    const mNum = Number(month);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12) {
      const mm = month.padStart(2, '0');
      const period = `${year}-${mm}`;
      if (period >= START_PERIOD && period <= CURRENT_PERIOD) {
        return { period, formatted: `${year}-${mm}-01` };
      }
    }
  }

  const sLower = s.toLowerCase();
  for (const [stem, mm] of Object.entries(RU_MONTHS)) {
    if (sLower.includes(stem)) {
      const yMatch = sLower.match(/\b(202[2-6]|2[2-6])\b/);
      if (yMatch) {
        const year = yMatch[1].length === 2 ? `20${yMatch[1]}` : yMatch[1];
        const period = `${year}-${mm}`;
        if (period >= START_PERIOD && period <= CURRENT_PERIOD) {
          const dMatch = sLower.match(/\b(\d{1,2})\b/);
          const dd = dMatch && Number(dMatch[1]) >= 1 && Number(dMatch[1]) <= 31 ? dMatch[1].padStart(2, '0') : '01';
          return { period, formatted: `${year}-${mm}-${dd}` };
        }
      }
    }
  }

  for (const [stem, mm] of Object.entries(SEASONS)) {
    if (sLower.includes(stem)) {
      const yMatch = sLower.match(/\b(202[2-6]|2[2-6])\b/);
      if (yMatch) {
        const year = yMatch[1].length === 2 ? `20${yMatch[1]}` : yMatch[1];
        const period = `${year}-${mm}`;
        if (period >= START_PERIOD && period <= CURRENT_PERIOD) {
          return { period, formatted: `${year}-${mm}-01` };
        }
      }
    }
  }

  return { period: null, formatted: '' };
}

/** Extracts Telegram post IDs and external source URLs from HTML description or extended data. */
function extractSources(htmlOrText?: string): { posts: number[]; sources: string[] } {
  if (!htmlOrText) return { posts: [], sources: [] };
  const posts: number[] = [];
  const sources: string[] = [];

  const postRegex = /(?:t\.me\/(?:lost_warinua|lostarmour)\/|#post_)(\d+)/gi;
  for (const m of htmlOrText.matchAll(postRegex)) {
    const id = parseInt(m[1], 10);
    if (id && !posts.includes(id)) {
      posts.push(id);
    }
  }

  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  for (const m of htmlOrText.matchAll(urlRegex)) {
    const u = m[0].replace(/[.,;)]+$/, '');
    if (!u.includes('lost_warinua') && !u.includes('lostarmour') && !u.includes('google.com/maps') && !sources.includes(u)) {
      sources.push(u);
    }
  }

  return { posts, sources };
}

interface KmlPlacemarkXml {
  name?: string;
  description?: string;
  ExtendedData?: {
    Data?: Array<{ '@_name'?: string; value?: string | number }>;
    SimpleData?: Array<{ '@_name'?: string; '#text'?: string | number }>;
  };
  Point?: {
    coordinates?: string;
  };
}

interface KmlFolderXml {
  name?: string;
  Placemark?: KmlPlacemarkXml | KmlPlacemarkXml[];
  Folder?: KmlFolderXml | KmlFolderXml[];
}

/** Extracts minimal placemarks from parsed KML tree. */
function extractPlacemarksFromKml(kmlText: string): { placemarks: RawPlacemark[]; totalPlacemarks: number } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
  });

  const parsed = parser.parse(kmlText) as {
    kml?: {
      Document?: {
        Folder?: KmlFolderXml | KmlFolderXml[];
        Placemark?: KmlPlacemarkXml | KmlPlacemarkXml[];
      };
    };
  };

  const placemarks: RawPlacemark[] = [];

  function processPlacemark(pm: KmlPlacemarkXml, folderSide: 'RF' | 'UA' | 'UNK' = 'RF') {
    const rawName = String(pm.name || '').trim();
    if (!rawName) return;

    let side: 'RF' | 'UA' | 'UNK' = folderSide;
    let date: string | undefined;
    let nazva: string | undefined;

    const extData = pm.ExtendedData;
    if (extData) {
      const items = [...(extData.Data || []), ...(extData.SimpleData || [])];
      for (const item of items) {
        const key = String(item['@_name'] || '').toLowerCase();
        const val = String(('value' in item ? item.value : undefined) ?? ('#text' in item ? item['#text'] : undefined) ?? '').trim();
        if (!val) continue;

        if (key === 'date' || key === 'дата') {
          date = val;
        } else if (key === 'nazva' || key === 'название' || key === 'name') {
          nazva = val;
        } else if (key === 'side' || key === 'сторона') {
          const vLow = val.toLowerCase();
          if (vLow.includes('rf') || vLow.includes('рф') || vLow.includes('рос')) side = 'RF';
          else if (vLow.includes('ua') || vLow.includes('укр')) side = 'UA';
        }
      }
    }

    const nameLow = rawName.toLowerCase();
    if (nameLow.includes('(укр)') || nameLow.includes('(всу)') || nameLow.includes('[укр]') || nameLow.startsWith('укр ') || nameLow.startsWith('всу ')) {
      side = 'UA';
    } else if (nameLow.includes('(рф)') || nameLow.includes('[рф]') || nameLow.startsWith('рф ')) {
      side = 'RF';
    }

    let lng: number | undefined;
    let lat: number | undefined;
    const coordsStr = pm.Point?.coordinates;
    if (coordsStr) {
      const parts = coordsStr.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        lng = Math.round(parts[0] * 1e5) / 1e5;
        lat = Math.round(parts[1] * 1e5) / 1e5;
      }
    }

    const { posts, sources } = extractSources(pm.description);

    const record: RawPlacemark = {
      name: rawName,
      side,
    };
    if (date) record.date = date;
    if (nazva) record.nazva = nazva;
    if (lng != null && lat != null) {
      record.lng = lng;
      record.lat = lat;
    }
    if (posts.length > 0) record.posts = posts;
    if (sources.length > 0) record.sources = sources;

    placemarks.push(record);
  }

  function processFolder(folder: KmlFolderXml) {
    const fName = String(folder.name || '').toLowerCase();
    let folderSide: 'RF' | 'UA' | 'UNK' = 'RF';
    if (fName.includes('потери украины') || fName.includes('ua losses') || fName.includes('украина') || fName.includes('ukraine') || fName.includes('всу')) {
      folderSide = 'UA';
    } else if (fName.includes('неопознан') || fName.includes('неизвестн') || fName.includes('unknown') || fName.includes('uncategorized')) {
      folderSide = 'UNK';
    }

    if (folder.Placemark) {
      const pms = Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark];
      for (const pm of pms) {
        processPlacemark(pm, folderSide);
      }
    }
    if (folder.Folder) {
      const subFolders = Array.isArray(folder.Folder) ? folder.Folder : [folder.Folder];
      for (const sf of subFolders) {
        processFolder(sf);
      }
    }
  }

  const doc = parsed.kml?.Document;
  if (doc?.Placemark) {
    const pms = Array.isArray(doc.Placemark) ? doc.Placemark : [doc.Placemark];
    for (const pm of pms) processPlacemark(pm);
  }
  if (doc?.Folder) {
    const folders = Array.isArray(doc.Folder) ? doc.Folder : [doc.Folder];
    for (const f of folders) processFolder(f);
  }

  return { placemarks, totalPlacemarks: placemarks.length };
}

/** Classifies raw placemarks against classification rules dictionary. */
function classifyPlacemarks(placemarks: RawPlacemark[], rules: ClassificationRules) {
  const lookup = buildClassificationLookup(rules);
  const records: ParsedRecord[] = [];
  let unclassifiedCount = 0;
  let unkSideCount = 0;
  const unclassifiedNames = new Map<string, number>();

  for (const pm of placemarks) {
    let pmClean = cleanName(pm.name);
    let match = lookup.get(pmClean);

    // Check Назва for UNK placemarks without explicit model name in title
    if (!match && pm.side === 'UNK' && pm.nazva) {
      if (!pm.nazva.startsWith('http')) {
        const nazvaClean = cleanName(pm.nazva);
        const nazvaMatch = lookup.get(nazvaClean);
        if (nazvaMatch) {
          pmClean = nazvaClean;
          match = nazvaMatch;
        }
      }
    }

    if (!match) {
      if (pm.side === 'UNK') {
        unkSideCount++;
      } else {
        unclassifiedNames.set(pmClean, (unclassifiedNames.get(pmClean) || 0) + 1);
      }
      unclassifiedCount++;
      continue;
    }

    const { period, formatted } = parseDate(pm.date);

    // Merge any proof links from nazva if nazva was a URL
    const posts = [...(pm.posts || [])];
    const sources = [...(pm.sources || [])];
    if (pm.nazva && (pm.nazva.startsWith('http') || pm.nazva.includes('t.me'))) {
      const { posts: extraPosts, sources: extraSources } = extractSources(pm.nazva);
      for (const p of extraPosts) {
        if (!posts.includes(p)) posts.push(p);
      }
      for (const s of extraSources) {
        if (!sources.includes(s)) sources.push(s);
      }
    }

    records.push({
      name: match.modelEn,
      category: match.category,
      side: pm.side,
      period,
      hasDate: Boolean(period),
      rawDate: formatted || '',
      lng: pm.lng,
      lat: pm.lat,
      posts,
      sources,
    });
  }

  return { records, unclassifiedCount, unkSideCount, unclassifiedNames };
}

/** Aggregates parsed records into structured ParsedLossesResult. */
function aggregateLossesData(records: ParsedRecord[], totalPlacemarks: number): ParsedLossesResult {
  const allPeriods = new Set<string>();
  const curY = new Date().getFullYear();
  const curM = new Date().getMonth() + 1;
  for (let y = 2022; y <= curY; y++) {
    const maxM = y === curY ? curM : 12;
    const startM = y === 2022 ? 2 : 1;
    for (let m = startM; m <= maxM; m++) {
      allPeriods.add(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  const periods = Array.from(allPeriods).sort();

  const totalRf = records.filter((r) => r.side === 'RF').length;
  const totalUa = records.filter((r) => r.side === 'UA').length;

  const categoryTotals: Record<WarLossCategory, { rf: number; ua: number }> = Object.fromEntries(WAR_LOSS_CATEGORIES.map((c) => [c, { rf: 0, ua: 0 }])) as Record<
    WarLossCategory,
    { rf: number; ua: number }
  >;

  const monthlyCategoryTotals: Record<string, Record<WarLossCategory, { rf: number; ua: number }>> = {};
  for (const p of periods) {
    monthlyCategoryTotals[p] = Object.fromEntries(WAR_LOSS_CATEGORIES.map((c) => [c, { rf: 0, ua: 0 }])) as Record<WarLossCategory, { rf: number; ua: number }>;
  }

  const modelCounts: Record<WarLossCategory, { rf: Record<string, number>; ua: Record<string, number> }> = Object.fromEntries(WAR_LOSS_CATEGORIES.map((c) => [c, { rf: {}, ua: {} }])) as Record<
    WarLossCategory,
    { rf: Record<string, number>; ua: Record<string, number> }
  >;

  const uniqueModels = new Set<string>();

  for (const r of records) {
    if (r.side === 'RF' || r.side === 'UA') {
      const sideKey = r.side === 'RF' ? 'rf' : 'ua';
      categoryTotals[r.category][sideKey]++;

      if (r.period && monthlyCategoryTotals[r.period]) {
        monthlyCategoryTotals[r.period][r.category][sideKey]++;
      }

      modelCounts[r.category][sideKey][r.name] = (modelCounts[r.category][sideKey][r.name] || 0) + 1;
    }
    uniqueModels.add(r.name);
  }

  const categories: LossCategoryItem[] = WAR_LOSS_CATEGORIES.map((cat) => {
    const { rf, ua } = categoryTotals[cat];
    return {
      id: cat,
      rf,
      ua,
      ratio: ratio(rf, ua, 2) ?? undefined,
    };
  }).sort((a, b) => b.rf + b.ua - (a.rf + a.ua));

  const byCategory: Record<WarLossCategory, LossCategoryDetailData> = Object.fromEntries(
    WAR_LOSS_CATEGORIES.map((cat) => {
      const rfModels: LossEquipmentModel[] = Object.entries(modelCounts[cat].rf)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const uaModels: LossEquipmentModel[] = Object.entries(modelCounts[cat].ua)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return [cat, { models: { rf: rfModels, ua: uaModels } }];
    }),
  ) as Record<WarLossCategory, LossCategoryDetailData>;

  const sortedCatIds = categories.map((c) => c.id);
  const categoryChart = {
    categories: sortedCatIds,
    rf: sortedCatIds.map((c) => categoryTotals[c].rf),
    ua: sortedCatIds.map((c) => categoryTotals[c].ua),
    ratios: sortedCatIds.map((c) => ratio(categoryTotals[c].rf, categoryTotals[c].ua, 2) ?? 0),
  };

  const monthlyRf: number[] = [];
  const monthlyUa: number[] = [];
  const monthlyBreakdowns: LossTimelineBreakdownItem[][] = [];

  for (const p of periods) {
    let sumRf = 0;
    let sumUa = 0;
    const items: LossTimelineBreakdownItem[] = [];

    for (const cat of WAR_LOSS_CATEGORIES) {
      const { rf, ua } = monthlyCategoryTotals[p][cat];
      sumRf += rf;
      sumUa += ua;
      if (rf > 0 || ua > 0) {
        items.push({ category: cat, rf, ua });
      }
    }

    items.sort((a, b) => b.rf + b.ua - (a.rf + a.ua));
    monthlyRf.push(sumRf);
    monthlyUa.push(sumUa);
    monthlyBreakdowns.push(items);
  }

  const overallTimeline = {
    rf: monthlyRf,
    ua: monthlyUa,
    breakdowns: monthlyBreakdowns,
  };

  const modelsList = Array.from(uniqueModels).sort();
  const modelIndexMap = new Map(modelsList.map((m, idx) => [m, idx]));
  const catIndexMap = new Map(WAR_LOSS_CATEGORIES.map((c, idx) => [c, idx]));

  const mapPoints: LossMapPoint[] = [];
  for (const r of records) {
    if (r.lng == null || r.lat == null) continue;
    const sideIdx = r.side === 'RF' ? 0 : r.side === 'UA' ? 1 : 2;
    const catIdx = catIndexMap.get(r.category) ?? 0;
    const modelIdx = modelIndexMap.get(r.name) ?? 0;
    const pt: LossMapPoint = [r.lng, r.lat, sideIdx, catIdx, modelIdx, r.rawDate, r.posts];
    if (r.sources.length > 0) {
      pt.push(r.sources);
    }
    mapPoints.push(pt);
  }

  const map: LossesMapSectionData = {
    categories: [...WAR_LOSS_CATEGORIES],
    models: modelsList,
    sides: ['RF', 'UA', 'UNK'],
    points: mapPoints,
  };

  return {
    summary: {
      totalRf,
      totalUa,
      overallRatio: ratio(totalRf, totalUa, 2) ?? 0,
      totalRecords: totalPlacemarks,
      unclassifiedRecords: totalPlacemarks - records.length,
      categories,
    },
    periods,
    overallTimeline,
    categoryChart,
    byCategory,
    map,
  };
}

/** Parses military equipment losses from Google My Maps or committed minimal data-losses.json snapshot. */
export async function parseLosses(forceUpdate = false): Promise<ParsedLossesResult> {
  const logger = getLogger();
  let placemarks: RawPlacemark[] = [];
  let totalPlacemarks = 0;

  const hasDataFile = await fileExists(DATA_FILE);
  if (!forceUpdate && hasDataFile) {
    logger.debug('Loading cached placemarks from data-losses.json...');
    const cache = await readJson<WarLossesPipelineCache>(DATA_FILE);
    placemarks = cache.placemarks;
    totalPlacemarks = cache.meta?.totalPlacemarks ?? placemarks.length;
  } else {
    const kmlText = await fetchKmlText();
    const extracted = extractPlacemarksFromKml(kmlText);
    placemarks = extracted.placemarks;
    totalPlacemarks = extracted.totalPlacemarks;

    await writeJson(
      DATA_FILE,
      {
        meta: {
          lastUpdated: new Date().toISOString(),
          totalPlacemarks,
        },
        placemarks,
      },
      0,
    );
    logger.debug(`Saved ${placemarks.length.toLocaleString()} minimal placemarks to data-losses.json`);
  }

  const rules = await readJson<ClassificationRules>(CLASSIFICATION_FILE);
  const { records, unclassifiedCount, unkSideCount, unclassifiedNames } = classifyPlacemarks(placemarks, rules);
  const dataset = aggregateLossesData(records, totalPlacemarks);

  const classifiedCount = records.length;
  const classifiedPct = ((classifiedCount / totalPlacemarks) * 100).toFixed(2);
  const namelessCount = unclassifiedNames.get('без названия') || 0;
  const otherUnclassified = [...unclassifiedNames.entries()].filter(([name]) => name !== 'без названия' && name !== '').sort((a, b) => b[1] - a[1]);
  const otherCount = otherUnclassified.reduce((sum, [, count]) => sum + count, 0);

  logger.debug(
    `Classification: ${classifiedCount.toLocaleString()} / ${totalPlacemarks.toLocaleString()} (${classifiedPct}%) classified | ${unclassifiedCount} skipped (${unkSideCount} UNK side, ${namelessCount} nameless pins, ${otherCount} excluded/markers)`,
  );

  return dataset;
}
