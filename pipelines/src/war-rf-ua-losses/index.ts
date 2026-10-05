import path from 'node:path';
import {
  type LossCategoryDetailData,
  type LossCategoryItem,
  type LossEquipmentModel,
  type LossMapPoint,
  type LossTimelineBreakdownItem,
  WAR_LOSS_CATEGORIES,
  type WarLossCategory,
  type WarLossesDataset,
  type WarLossMapDataset,
} from '@graphs/types';
import { XMLParser } from 'fast-xml-parser';
import { exportDataset, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchWithRetry } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { ratio } from '@/utils/math';
import { PIPELINES_SRC_DIR } from '@/utils/paths';

const DATA_FILE = getPipelineDataPath('war-rf-ua-losses');
const CLASSIFICATION_FILE = path.resolve(PIPELINES_SRC_DIR, 'war-rf-ua-losses/classification.json');

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
  let n = name.toLowerCase().replace(/\xa0/g, ' ');
  n = n.replace(/\s*№?\s*(?:rf|ra|рф|ра|rа)[-\s]*\d+/g, '');
  n = n.replace(/\s+/g, ' ');
  return n.trim();
}

/** Pre-builds an inverted hash map from raw name to category and canonical English model. */
function buildClassificationLookup(rules: ClassificationRules): Map<string, { category: WarLossCategory; modelEn: string }> {
  const lookup = new Map<string, { category: WarLossCategory; modelEn: string }>();
  for (const [category, models] of Object.entries(rules)) {
    for (const [modelEn, raws] of Object.entries(models)) {
      for (const raw of raws) {
        lookup.set(raw.toLowerCase().trim(), { category: category as WarLossCategory, modelEn });
      }
    }
  }
  return lookup;
}

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

  // Normalize volunteer punctuation typos (commas, semicolons, duplicate dots, leading dots, spaces)
  s = s
    .replace(/^[.\s]+/, '')
    .replace(/[,;]/g, '.')
    .replace(/\.{2,}/g, '.');
  s = s.replace(/^(\d{1,2})\s+(\d{1,2})\.(\d{2,4})/, '$1.$2.$3');
  s = s.replace(/^(\d{1,2})\.(\d{1,2})\s+(\d{2,4})/, '$1.$2.$3');
  s = s.replace(/^(\d{1,2})-\d{1,2}\./, '$1.');

  // Match DD.MM.YYYY or DD/MM/YYYY (with optional trailing text)
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
      if (formatted <= TODAY_ISO) {
        return { period: `${year}-${mm}`, formatted };
      }
    }
  }

  // Match DD.MM.YY or DD/MM/YY (with optional trailing text)
  const m2 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})(?:\b|$)/);
  if (m2) {
    const [, day, month, yy] = m2;
    const year = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
    const yNum = Number(year);
    const mNum = Number(month);
    const dNum = Number(day);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const mm = month.padStart(2, '0');
      const dd = day.padStart(2, '0');
      const formatted = `${year}-${mm}-${dd}`;
      if (formatted <= TODAY_ISO) {
        return { period: `${year}-${mm}`, formatted };
      }
    }
  }

  // Match MM.YYYY or MM/YYYY
  const m3 = s.match(/^(\d{1,2})[./](\d{4})(?:\b|$)/);
  if (m3) {
    const [, month, year] = m3;
    const yNum = Number(year);
    const mNum = Number(month);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12) {
      const mm = month.padStart(2, '0');
      const period = `${year}-${mm}`;
      if (period <= CURRENT_PERIOD) {
        return { period, formatted: period };
      }
    }
  }

  // Match MM.YY or MM/YY (e.g. 03.22, 05.23)
  const m4 = s.match(/^(\d{1,2})[./](\d{2})(?:\b|$)/);
  if (m4) {
    const [, month, yy] = m4;
    const year = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
    const yNum = Number(year);
    const mNum = Number(month);
    if (yNum >= 2022 && mNum >= 1 && mNum <= 12) {
      const mm = month.padStart(2, '0');
      const period = `${year}-${mm}`;
      if (period <= CURRENT_PERIOD) {
        return { period, formatted: period };
      }
    }
  }

  const lower = s.toLowerCase();

  // Match Seasons to centroid month (e.g. "Весна 2022", "Осень 2024", "Зима-Весна 2023", "лето 2023", "Весна (Лето) 2023")
  for (const [prefix, mm] of Object.entries(SEASONS)) {
    if (lower.includes(prefix)) {
      const ym = lower.match(/\b(20\d{2})\b/);
      if (ym) {
        const year = ym[1];
        const period = `${year}-${mm}`;
        if (Number(year) >= 2022 && period <= CURRENT_PERIOD) {
          return { period, formatted: period };
        }
      }
    }
  }

  // Match Russian textual months or month ranges (e.g. "Январь 2024", "Февраль-Март 2022", "Март (Апрель) 2022")
  let firstMonthPos = -1;
  let firstMonthCode = '';
  for (const [prefix, mm] of Object.entries(RU_MONTHS)) {
    const pos = lower.indexOf(prefix);
    if (pos !== -1 && (firstMonthPos === -1 || pos < firstMonthPos)) {
      firstMonthPos = pos;
      firstMonthCode = mm;
    }
  }

  if (firstMonthCode) {
    const ym = lower.match(/\b(20\d{2})\b/);
    if (ym) {
      const year = ym[1];
      const period = `${year}-${firstMonthCode}`;
      if (Number(year) >= 2022 && period <= CURRENT_PERIOD) {
        return { period, formatted: period };
      }
    }
  }

  return { period: null, formatted: '' };
}

interface ClassifyResult {
  records: ParsedRecord[];
  totalPlacemarks: number;
  unclassifiedSideUnk: number;
  unclassifiedNames: Map<string, number>;
}

/** Safely extracts text value from fast-xml-parser node or object. */
function extractXmlValue(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'object' && val !== null && '#text' in val) {
    return String((val as Record<string, unknown>)['#text'] || '');
  }
  return String(val);
}

/** Extracts sanitized raw placemarks from KML XML string in memory. */
function extractPlacemarksFromKml(xmlContent: string): { placemarks: RawPlacemark[]; totalPlacemarks: number } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xmlContent);

  function collectFolders(node: unknown): Record<string, unknown>[] {
    const folders: Record<string, unknown>[] = [];
    if (!node || typeof node !== 'object') return folders;
    const n = node as Record<string, unknown>;
    if (n.Folder) {
      if (Array.isArray(n.Folder)) {
        for (const f of n.Folder) {
          folders.push(f as Record<string, unknown>);
          folders.push(...collectFolders(f));
        }
      } else {
        folders.push(n.Folder as Record<string, unknown>);
        folders.push(...collectFolders(n.Folder));
      }
    }
    if (n.Document) {
      folders.push(...collectFolders(n.Document));
    }
    if (n.kml) {
      folders.push(...collectFolders(n.kml));
    }
    return folders;
  }

  const allFolders = collectFolders(parsed);
  const placemarks: RawPlacemark[] = [];
  let totalPlacemarks = 0;

  for (const folder of allFolders) {
    const folderName = String(folder.name || '').toLowerCase();
    let side: 'RF' | 'UA' | 'UNK' = 'RF';
    if (folderName.includes('всу')) {
      side = 'UA';
    } else if (folderName.includes('неопознанное')) {
      side = 'UNK';
    }

    const pms = folder.Placemark ? (Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark]) : [];

    for (const pm of pms) {
      totalPlacemarks++;
      const name = String(pm.name || 'Без названия').trim();

      let dateVal: string | undefined;
      let nazvaVal: string | undefined;
      const allTexts: string[] = [String(pm.description || '')];
      const extData = pm.ExtendedData;
      if (extData?.Data) {
        const dataList = (Array.isArray(extData.Data) ? extData.Data : [extData.Data]) as Record<string, unknown>[];
        for (const d of dataList) {
          const attrName = d['@_name'];
          if (attrName === 'дата') {
            dateVal = extractXmlValue(d.value);
          } else if (attrName === 'Назва') {
            nazvaVal = extractXmlValue(d.value);
          }
          const v = extractXmlValue(d.value);
          if (v) allTexts.push(v);
        }
      }

      // Extract all external HTTP(S) links across description, Назва, опис, описание
      const extUrls = new Set<string>();
      for (const text of allTexts) {
        const matches = text.match(/https?:\/\/[^\s<"'>]+/g) || [];
        for (const m of matches) {
          if (!m.includes('google.com') && !m.includes('usercontent')) {
            extUrls.add(m);
          }
        }
      }

      const posts: number[] = [];
      const sources: string[] = [];
      for (const url of extUrls) {
        const m = url.match(/lost_warinua\/(\d+)/);
        if (m) {
          const num = Number.parseInt(m[1], 10);
          if (num > 0 && !posts.includes(num)) {
            posts.push(num);
          }
        } else {
          if (!sources.includes(url)) {
            sources.push(url);
          }
        }
      }

      let lng: number | undefined;
      let lat: number | undefined;
      if (pm.Point?.coordinates) {
        const coords = String(pm.Point.coordinates).trim().split(',');
        const parsedLng = Number(Number(coords[0]).toFixed(4));
        const parsedLat = Number(Number(coords[1]).toFixed(4));
        if (!Number.isNaN(parsedLng) && !Number.isNaN(parsedLat)) {
          lng = parsedLng;
          lat = parsedLat;
        }
      }

      const rawItem: RawPlacemark = {
        name,
        side,
      };
      if (dateVal) rawItem.date = dateVal;
      if (nazvaVal) rawItem.nazva = nazvaVal;
      if (lng !== undefined) rawItem.lng = lng;
      if (lat !== undefined) rawItem.lat = lat;
      if (posts.length > 0) rawItem.posts = posts;
      if (sources.length > 0) rawItem.sources = sources;

      placemarks.push(rawItem);
    }
  }

  return { placemarks, totalPlacemarks };
}

/** Classifies raw placemarks against classification rules into ParsedRecord[]. */
function classifyPlacemarks(placemarks: RawPlacemark[], rules: ClassificationRules): ClassifyResult {
  const lookup = buildClassificationLookup(rules);
  const records: ParsedRecord[] = [];
  let unclassifiedSideUnk = 0;
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
        unclassifiedSideUnk++;
      } else {
        unclassifiedNames.set(pmClean, (unclassifiedNames.get(pmClean) || 0) + 1);
      }
      continue;
    }

    const { period, formatted: rawDate } = parseDate(pm.date);

    records.push({
      name: match.modelEn,
      category: match.category,
      side: pm.side,
      period,
      hasDate: period != null,
      rawDate,
      lng: pm.lng,
      lat: pm.lat,
      posts: pm.posts || [],
      sources: pm.sources || [],
    });
  }

  return {
    records,
    totalPlacemarks: placemarks.length,
    unclassifiedSideUnk,
    unclassifiedNames,
  };
}

/** Aggregates statistics, timeline pivots, and model breakdowns into WarLossesDataset. */
function aggregateLossesData(records: ParsedRecord[], totalPlacemarks: number): WarLossesDataset {
  const logger = getLogger();
  logger.debug('Aggregating statistics for JSON export...');

  const datedRecords = records.filter((r) => r.hasDate && r.period != null);
  const periodsSet = new Set<string>();
  for (const r of datedRecords) {
    if (r.period) periodsSet.add(r.period);
  }
  const allPeriods = Array.from(periodsSet).sort();

  let totalRf = 0;
  let totalUa = 0;

  for (const r of records) {
    if (r.side === 'RF') totalRf++;
    else if (r.side === 'UA') totalUa++;
  }

  const categorySummary: LossCategoryItem[] = [];
  const categoryTimelines: Partial<Record<WarLossCategory, { rf: number[]; ua: number[] }>> = {};
  const byCategory = {} as Record<WarLossCategory, LossCategoryDetailData>;

  for (const catId of WAR_LOSS_CATEGORIES) {
    const catRecords = records.filter((r) => r.category === catId);
    let catRf = 0;
    let catUa = 0;

    for (const r of catRecords) {
      if (r.side === 'RF') catRf++;
      else if (r.side === 'UA') catUa++;
    }

    categorySummary.push({
      id: catId,
      rf: catRf,
      ua: catUa,
      ratio: ratio(catRf, catUa, 2),
    });

    // Monthly timelines
    const rfTimeline = new Array(allPeriods.length).fill(0);
    const uaTimeline = new Array(allPeriods.length).fill(0);

    const catDated = catRecords.filter((r) => r.hasDate && r.period != null);
    for (const r of catDated) {
      const idx = allPeriods.indexOf(r.period!);
      if (idx !== -1) {
        if (r.side === 'RF') rfTimeline[idx]++;
        else if (r.side === 'UA') uaTimeline[idx]++;
      }
    }

    function getTopModels(side: 'RF' | 'UA', limit?: number): LossEquipmentModel[] {
      const counts = new Map<string, number>();
      for (const r of catRecords) {
        if (r.side === side) {
          counts.set(r.name, (counts.get(r.name) || 0) + 1);
        }
      }
      let sorted = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      if (limit) sorted = sorted.slice(0, limit);
      return sorted;
    }

    categoryTimelines[catId] = {
      rf: rfTimeline,
      ua: uaTimeline,
    };
    byCategory[catId] = {
      models: {
        rf: getTopModels('RF'),
        ua: getTopModels('UA'),
      },
    };
  }

  // Overall monthly timeline
  const overallRf = new Array(allPeriods.length).fill(0);
  const overallUa = new Array(allPeriods.length).fill(0);

  for (const r of datedRecords) {
    const idx = allPeriods.indexOf(r.period!);
    if (idx !== -1) {
      if (r.side === 'RF') overallRf[idx]++;
      else if (r.side === 'UA') overallUa[idx]++;
    }
  }

  const breakdowns: LossTimelineBreakdownItem[][] = [];

  for (let idx = 0; idx < allPeriods.length; idx++) {
    const breakdown: LossTimelineBreakdownItem[] = categorySummary.map((c) => ({
      category: c.id,
      rf: categoryTimelines[c.id]?.rf[idx] || 0,
      ua: categoryTimelines[c.id]?.ua[idx] || 0,
    }));
    breakdown.sort((a, b) => b.rf + b.ua - (a.rf + a.ua));
    breakdowns.push(breakdown);
  }

  // Build compact map dataset
  const modelsList: string[] = [];
  const modelIdxMap = new Map<string, number>();
  const mapPoints: LossMapPoint[] = [];

  for (const r of records) {
    if (r.lng == null || r.lat == null) continue;
    let mIdx = modelIdxMap.get(r.name);
    if (mIdx === undefined) {
      mIdx = modelsList.length;
      modelsList.push(r.name);
      modelIdxMap.set(r.name, mIdx);
    }
    const sideIdx = r.side === 'RF' ? 0 : r.side === 'UA' ? 1 : 2;
    const catIdx = WAR_LOSS_CATEGORIES.indexOf(r.category);
    const pt: LossMapPoint = [r.lng, r.lat, sideIdx, catIdx, mIdx, r.rawDate, r.posts];
    if (r.sources.length > 0) {
      pt.push(r.sources);
    }
    mapPoints.push(pt);
  }

  const mapDataset: WarLossMapDataset = {
    categories: [...WAR_LOSS_CATEGORIES],
    models: modelsList,
    sides: ['RF', 'UA', 'UNK'],
    points: mapPoints,
  };

  const dataset: WarLossesDataset = {
    summary: {
      totalRecords: records.length,
      unclassifiedRecords: Math.max(0, totalPlacemarks - records.length),
      totalRf,
      totalUa,
      overallRatio: ratio(totalRf, totalUa, 2, 0) ?? 0,
      categories: categorySummary,
    },
    categoryChart: {
      categories: categorySummary.map((c) => c.id),
      rf: categorySummary.map((c) => c.rf),
      ua: categorySummary.map((c) => c.ua),
      ratios: categorySummary.map((c) => c.ratio ?? 0),
    },
    periods: allPeriods,
    overallTimeline: {
      rf: overallRf,
      ua: overallUa,
      breakdowns,
    },
    byCategory,
    map: mapDataset,
  };

  return dataset;
}

/** Runs the War Losses ETL Pipeline. Parses KML / cached placemarks and classification rules, builds aggregated dataset, and exports to war-rf-ua-losses.json. */
export async function runWarLossesPipeline(forceUpdate = false, verbose?: boolean): Promise<WarLossesDataset> {
  return runWithLogger(
    'war-rf-ua-losses',
    async () => {
      const logger = getLogger();
      logger.start('Starting War Losses ETL pipeline');

      let placemarks: RawPlacemark[] = [];
      let totalPlacemarks = 0;

      const hasDataFile = await fileExists(DATA_FILE);
      if (!forceUpdate && hasDataFile) {
        logger.debug('Loading cached placemarks from local data.json...');
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
        logger.info(`Saved ${placemarks.length.toLocaleString()} minimal placemarks to data.json`);
      }

      const rules = await readJson<ClassificationRules>(CLASSIFICATION_FILE);
      const { records, unclassifiedSideUnk, unclassifiedNames } = classifyPlacemarks(placemarks, rules);
      const dataset = aggregateLossesData(records, totalPlacemarks);

      await exportDataset('war-rf-ua-losses', dataset);

      const classifiedCount = records.length;
      const unclassifiedCount = totalPlacemarks - classifiedCount;
      const classifiedPct = ((classifiedCount / totalPlacemarks) * 100).toFixed(2);
      const namelessCount = unclassifiedNames.get('без названия') || 0;
      const otherUnclassified = [...unclassifiedNames.entries()].filter(([name]) => name !== 'без названия' && name !== '').sort((a, b) => b[1] - a[1]);
      const otherCount = otherUnclassified.reduce((sum, [, count]) => sum + count, 0);

      logger.info(
        `Classification: ${classifiedCount.toLocaleString()} / ${totalPlacemarks.toLocaleString()} (${classifiedPct}%) classified | ${unclassifiedCount} skipped (${unclassifiedSideUnk} unknown attribution, ${namelessCount} nameless pins, ${otherCount} excluded/markers)`,
      );
      if (otherUnclassified.length > 0) {
        const topSkipped = otherUnclassified
          .slice(0, 6)
          .map(([name, count]) => `"${name}" (${count})`)
          .join(', ');
        logger.debug(`Skipped items: ${topSkipped}`);
      }

      logger.success(`Exported war-losses dataset (${classifiedCount.toLocaleString()} verified losses, ${dataset.map.points.length.toLocaleString()} map points, ${dataset.periods.length} months)`);
      return dataset;
    },
    verbose,
  );
}

if (import.meta.main) {
  runWarLossesPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('war-rf-ua-losses').error('Fatal error running War Losses pipeline:', err);
    process.exit(1);
  });
}
