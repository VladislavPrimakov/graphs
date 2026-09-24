import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import type { LossCategoryDataPoint, LossCategoryDetailData, LossCategoryItem, LossEquipmentModel, LossTimelineBreakdownItem, LossTimelineDataPoint, WarLossesDataset } from '@/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const KML_FILE = path.join(CACHE_DIR, 'map_data.kml');
const CLASSIFICATION_FILE = path.resolve(SCRIPT_DIR, 'classification.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/war-rf-ua-losses.json');

const GOOGLE_MAPS_KML_URL = 'https://www.google.com/maps/d/kml?mid=1dRn8TRMDLRkaaIBJad0YZvTt3dmiuxo&forcekml=1';

const CATEGORY_TRANSLATIONS: Record<string, { id: string; en: string; ru: string }> = {
  самолёты: { id: 'aircraft', en: 'Aircraft', ru: 'Самолёты' },
  вертолеты: { id: 'helicopters', en: 'Helicopters', ru: 'Вертолёты' },
  танки: { id: 'tanks', en: 'Tanks', ru: 'Танки' },
  бронетехника: { id: 'armored', en: 'Armored Vehicles', ru: 'Бронетехника' },
  артиллерия: { id: 'artillery', en: 'Artillery', ru: 'Артиллерия' },
  рсзо: { id: 'mlrs', en: 'MLRS', ru: 'РСЗО' },
  пво: { id: 'air_defense', en: 'Air Defense', ru: 'ПВО' },
  автотранспорт: { id: 'vehicles', en: 'Support Vehicles', ru: 'Автотранспорт' },
};

interface ClassificationRules {
  plot?: Record<string, Record<string, string[]>>;
  unplot?: Record<string, Record<string, string[]>>;
}

interface ParsedRecord {
  name: string;
  type: string;
  side: 'РФ' | 'Украина' | 'Неизвестно';
  period: string | null;
  hasDate: boolean;
}

/** Downloads latest KML map data from Google My Maps into cache. */
async function downloadKml(filePath: string): Promise<void> {
  const logger = getLogger();
  await ensureDir(filePath);
  logger.debug(`Downloading KML from Google My Maps to ${filePath}...`);
  try {
    const res = await fetchWithRetry(GOOGLE_MAPS_KML_URL, { retries: 2, timeoutMs: 40000 });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      logger.debug(`Successfully downloaded: ${filePath}`);
    }
  } catch (err) {
    logger.warn(`Could not download fresh KML (${err}).`);
    if (await fileExists(filePath)) {
      logger.debug('Using existing cached KML file.');
    } else {
      throw err;
    }
  }
}

/** Normalizes raw placemark title string. */
function cleanName(name: string): string {
  if (!name) return '';
  let n = name.toLowerCase().replace(/\xa0/g, ' ');
  n = n.replace(/\s*№?\s*(?:rf|ra|рф|ра|rа)[-\s]*\d+/g, '');
  n = n.replace(/\s+/g, ' ');
  return n.trim();
}

/** Pre-builds an inverted hash map from raw name to (eqType, canonName). */
function buildClassificationLookup(rules: ClassificationRules): Map<string, [string, string]> {
  const lookup = new Map<string, [string, string]>();
  for (const [eqType, groups] of Object.entries(rules.plot || {})) {
    for (const [canon, raws] of Object.entries(groups)) {
      for (const raw of raws) {
        lookup.set(raw, [eqType, canon]);
      }
    }
  }
  for (const [, groups] of Object.entries(rules.unplot || {})) {
    for (const [canon, raws] of Object.entries(groups)) {
      for (const raw of raws) {
        lookup.set(raw, ['Unplot', canon]);
      }
    }
  }
  return lookup;
}

/** Parses dates formatted as DD.MM.YYYY or MM.YYYY into YYYY-MM. */
function parseDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  const m1 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m1) {
    const [, , month, year] = m1;
    return `${year}-${month}`;
  }
  const m2 = s.match(/^(\d{2})\.(\d{4})$/);
  if (m2) {
    const [, month, year] = m2;
    return `${year}-${month}`;
  }
  return null;
}

/** Parses 35MB KML map dataset using high-performance streaming fast-xml-parser. */
async function parseKml(filePath: string, rules: ClassificationRules): Promise<{ records: ParsedRecord[]; unclassified: string[] }> {
  const logger = getLogger();
  logger.debug('Parsing KML file...');
  const xmlContent = await fs.readFile(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xmlContent);
  const lookup = buildClassificationLookup(rules);

  const records: ParsedRecord[] = [];
  const unclassified: string[] = [];

  // Traverse KML Folder hierarchy
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

  for (const folder of allFolders) {
    const folderName = String(folder.name || '').toLowerCase();
    let side: 'РФ' | 'Украина' | 'Неизвестно' = 'РФ';
    if (folderName.includes('всу')) {
      side = 'Украина';
    } else if (folderName.includes('неопознанное')) {
      side = 'Неизвестно';
    }

    const placemarks = folder.Placemark ? (Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark]) : [];

    for (const pm of placemarks) {
      const pmNameRaw = String(pm.name || 'Без названия');
      const pmClean = cleanName(pmNameRaw);
      const match = lookup.get(pmClean);
      const eqType = match ? match[0] : 'Другое';
      const canonName = match ? match[1] : pmClean;

      if (eqType === 'Unplot') continue;
      if (eqType === 'Другое') {
        if (side !== 'Неизвестно') {
          unclassified.push(pmClean);
        }
        continue;
      }

      let dateVal: string | undefined;
      const extData = pm.ExtendedData;
      if (extData?.Data) {
        const dataList = Array.isArray(extData.Data) ? extData.Data : [extData.Data];
        for (const d of dataList) {
          if (d['@_name'] === 'дата') {
            dateVal = typeof d.value === 'object' ? String(d.value['#text'] || '') : String(d.value || '');
            break;
          }
        }
      }

      const monthStr = parseDate(dateVal);
      records.push({
        name: canonName,
        type: eqType,
        side,
        period: monthStr,
        hasDate: monthStr != null,
      });
    }
  }

  return { records, unclassified };
}

/** Aggregates statistics, timeline pivots, and model breakdowns into WarLossesDataset. */
function aggregateLossesData(records: ParsedRecord[], rules: ClassificationRules): WarLossesDataset {
  const logger = getLogger();
  logger.debug('Aggregating statistics for JSON export...');
  const types = Object.keys(rules.plot || {});

  const datedRecords = records.filter((r) => r.hasDate && r.period != null);
  const periodsSet = new Set<string>();
  for (const r of datedRecords) {
    if (r.period) periodsSet.add(r.period);
  }
  const allPeriods = Array.from(periodsSet).sort();

  let totalRf = 0;
  let totalUa = 0;
  let totalUnk = 0;

  for (const r of records) {
    if (r.side === 'РФ') totalRf++;
    else if (r.side === 'Украина') totalUa++;
    else totalUnk++;
  }

  const categorySummary: LossCategoryItem[] = [];
  const byCategory: Record<string, LossCategoryDetailData & { timeline: { rf: number[]; ua: number[]; unknown: number[] } }> = {};

  for (const eqType of types) {
    const catRecords = records.filter((r) => r.type === eqType);
    let catRf = 0;
    let catUa = 0;

    for (const r of catRecords) {
      if (r.side === 'РФ') catRf++;
      else if (r.side === 'Украина') catUa++;
    }

    const trans = CATEGORY_TRANSLATIONS[eqType] || { id: eqType, en: eqType, ru: eqType };

    categorySummary.push({
      id: trans.id,
      label_en: trans.en,
      label_ru: trans.ru,
      rf: catRf,
      ua: catUa,
      ratio: catUa > 0 ? String(Math.round((catRf / catUa) * 100) / 100) : undefined,
    });

    // Monthly timelines
    const rfTimeline = new Array(allPeriods.length).fill(0);
    const uaTimeline = new Array(allPeriods.length).fill(0);
    const unkTimeline = new Array(allPeriods.length).fill(0);

    const catDated = catRecords.filter((r) => r.hasDate && r.period != null);
    for (const r of catDated) {
      const idx = allPeriods.indexOf(r.period!);
      if (idx !== -1) {
        if (r.side === 'РФ') rfTimeline[idx]++;
        else if (r.side === 'Украина') uaTimeline[idx]++;
        else unkTimeline[idx]++;
      }
    }

    function getTopModels(side: 'РФ' | 'Украина' | 'Неизвестно', limit?: number): LossEquipmentModel[] {
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

    byCategory[trans.id] = {
      timeline: {
        rf: rfTimeline,
        ua: uaTimeline,
        unknown: unkTimeline,
      },
      models: {
        rf: getTopModels('РФ'),
        ua: getTopModels('Украина'),
      },
    };
  }

  // Overall monthly timeline
  const overallRf = new Array(allPeriods.length).fill(0);
  const overallUa = new Array(allPeriods.length).fill(0);

  for (const r of datedRecords) {
    const idx = allPeriods.indexOf(r.period!);
    if (idx !== -1) {
      if (r.side === 'РФ') overallRf[idx]++;
      else if (r.side === 'Украина') overallUa[idx]++;
    }
  }

  const timelineRfSeries: LossTimelineDataPoint[] = [];
  const timelineUaSeries: LossTimelineDataPoint[] = [];

  for (let idx = 0; idx < allPeriods.length; idx++) {
    const rfVal = overallRf[idx];
    const uaVal = overallUa[idx];

    const breakdown: LossTimelineBreakdownItem[] = categorySummary.map((c) => ({
      name: c.label_en,
      rf: byCategory[c.id]?.timeline.rf[idx] || 0,
      ua: byCategory[c.id]?.timeline.ua[idx] || 0,
    }));
    breakdown.sort((a, b) => b.rf + b.ua - (a.rf + a.ua));

    timelineRfSeries.push({
      value: rfVal,
      rf: rfVal,
      ua: uaVal,
      breakdown,
    });
    timelineUaSeries.push({
      value: uaVal,
      rf: rfVal,
      ua: uaVal,
      breakdown,
    });
  }

  const rfCategoryPoints: LossCategoryDataPoint[] = categorySummary.map((c) => ({
    value: c.rf,
    label_en: c.label_en,
    label_ru: c.label_ru,
    ratio: c.ratio,
  }));

  const uaCategoryPoints: LossCategoryDataPoint[] = categorySummary.map((c) => ({
    value: c.ua,
    label_en: c.label_en,
    label_ru: c.label_ru,
    ratio: c.ratio,
  }));

  const dataset: WarLossesDataset = {
    summary: {
      total_records: records.length,
      total_rf: totalRf,
      total_ua: totalUa,
      total_unknown: totalUnk,
      overall_ratio: totalUa > 0 ? String(Math.round((totalRf / totalUa) * 100) / 100) : '0',
      categories: categorySummary,
    },
    category_chart: {
      labels: categorySummary.map((c) => c.label_en),
      rf_series: rfCategoryPoints,
      ua_series: uaCategoryPoints,
    },
    periods: allPeriods,
    overall_timeline: {
      rf_series: timelineRfSeries,
      ua_series: timelineUaSeries,
    },
    by_category: byCategory,
  };

  return dataset;
}

/** Runs the War Losses ETL Pipeline. Parses KML and classification rules, builds aggregated dataset, and exports to war-rf-ua-losses.json. */
export async function runWarLossesPipeline(verbose?: boolean): Promise<WarLossesDataset> {
  return runWithLogger(
    'war-rf-ua-losses',
    async () => {
      const logger = getLogger();
      logger.start('Starting War Losses ETL pipeline');

      await downloadKml(KML_FILE);
      const rules = await readJson<ClassificationRules>(CLASSIFICATION_FILE);
      const { records } = await parseKml(KML_FILE, rules);
      const dataset = aggregateLossesData(records, rules);

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('war-rf-ua-losses');
      logger.success(`Exported war-losses dataset (${records.length.toLocaleString()} verified losses, ${dataset.periods.length} months)`);
      return dataset;
    },
    verbose,
  );
}

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWarLossesPipeline().catch((err) => {
    getLogger('war-rf-ua-losses').error('Fatal error running War Losses pipeline:', err);
    process.exit(1);
  });
}
