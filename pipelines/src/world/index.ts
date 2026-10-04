import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorldChartMetricData, WorldDataset } from '@graphs/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';
import { resolveRegionCode } from '../utils/region.js';

try {
  process.loadEnvFile?.();
} catch {
  // .env may not exist in CI or certain environments
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const MACRO_CACHE_FILE = path.join(CACHE_DIR, 'macro_data_worldbank.json');
const PHYSICAL_CACHE_FILE = path.join(CACHE_DIR, 'physical_industrial_data.json');
const REPORTERS_CACHE_FILE = path.join(CACHE_DIR, 'comtrade_reporters.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/world.json');

const START_YEAR = 2000;
const END_YEAR = 2024;

/** Explicitly ignored global or non-geographic aggregate entities. */
export const EXCLUDED_ENTITIES = new Set([
  'WLD',
  '1W',
  'OWID_WRL',
  'World',
  'HIC',
  'LIC',
  'LMC',
  'UMC',
  'MIC',
  'LMY',
  'IBD',
  'IBT',
  'IDA',
  'IDB',
  'IDX',
  'IBB',
  'CSS',
  'OSS',
  'PSS',
  'SST',
  'PRE',
  'PST',
  'EAR',
  'LTE',
  'HPC',
  'LDC',
  'FCS',
  'FXS',
]);

interface MacroData {
  gdp_ppp_kd: Record<string, Record<number, number>>;
  gdp_pcap_ppp_kd: Record<string, Record<number, number>>;
  cpi: Record<string, Record<number, number>>;
  aggregates: string[];
}

interface PhysicalData {
  chapter84_nominal: Record<string, Record<number | string, number>>;
  electricity_twh: Record<string, Record<number | string, number>>;
  solar_wind_twh: Record<string, Record<number | string, number>>;
  elec_per_capita_kwh: Record<string, Record<number | string, number>>;
}

/** Fetches global macroeconomic series from World Bank API & IMF WEO. */
async function fetchMacroDataWorldBank(forceUpdate = false): Promise<MacroData> {
  const logger = getLogger();
  if (!forceUpdate && (await fileExists(MACRO_CACHE_FILE))) {
    try {
      const cached = await readJson<MacroData>(MACRO_CACHE_FILE);
      if (cached.gdp_ppp_kd && Object.keys(cached.gdp_ppp_kd).length > 0) {
        logger.debug(`Loaded Macro data from cache: ${path.basename(MACRO_CACHE_FILE)}`);
        return cached;
      }
    } catch {
      // ignore
    }
  }

  logger.debug('Fetching global macroeconomic series from World Bank API & IMF WEO...');
  const data: MacroData = {
    gdp_ppp_kd: {},
    gdp_pcap_ppp_kd: {},
    cpi: {},
    aggregates: [],
  };

  try {
    // 1. World Bank Countries metadata (for identifying aggregates vs sovereign countries)
    const countryRes = await fetchWithRetry('https://api.worldbank.org/v2/country?format=json&per_page=300', { retries: 2, timeoutMs: 30000 });
    if (countryRes.ok) {
      const [, wbCountries] = (await countryRes.json()) as [unknown, Array<{ id?: string; region?: { value?: string } }>];
      const aggs: string[] = [];
      for (const c of wbCountries || []) {
        if (c.id && c.id.length === 3 && c.region?.value === 'Aggregates') {
          aggs.push(c.id);
        }
      }
      data.aggregates = aggs;
    }

    // 2. Fetch World Bank indicators across all countries
    const indicators: Array<{ code: string; key: 'gdp_ppp_kd' | 'gdp_pcap_ppp_kd' | 'cpi' }> = [
      { code: 'NY.GDP.MKTP.PP.KD', key: 'gdp_ppp_kd' },
      { code: 'NY.GDP.PCAP.PP.KD', key: 'gdp_pcap_ppp_kd' },
      { code: 'FP.CPI.TOTL', key: 'cpi' },
    ];

    for (const ind of indicators) {
      const url = `https://api.worldbank.org/v2/country/all/indicator/${ind.code}?date=${START_YEAR}:${END_YEAR}&format=json&per_page=16000`;
      const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 45000 });
      if (res.ok) {
        const json = (await res.json()) as [unknown, Array<{ countryiso3code?: string; date?: string; value?: number | null }>];
        const rows = json[1] || [];
        for (const row of rows) {
          const code = row.countryiso3code;
          if (code?.length !== 3 || EXCLUDED_ENTITIES.has(code)) continue;
          const year = parseInt(row.date || '', 10);
          const val = row.value;
          if (!Number.isNaN(year) && year >= START_YEAR && year <= END_YEAR && val != null && !Number.isNaN(val)) {
            if (!data[ind.key][code]) data[ind.key][code] = {};
            data[ind.key][code][year] = val;
          }
        }
        logger.debug(`World Bank indicator ${ind.code}: parsed`);
      }
    }

    // 3. Taiwan from IMF WEO (since World Bank excludes Taiwan)
    const twnUrl = `https://api.db.nomics.world/v22/series/IMF/WEO:2024-10?observations=1&dimensions=${encodeURIComponent(
      JSON.stringify({ 'weo-country': ['TWN'], 'weo-subject': ['NGDPRPPPPC', 'LP', 'PCPI', 'NGDPD'] }),
    )}&limit=100`;

    try {
      const twnRes = await fetchWithRetry(twnUrl, { retries: 2, timeoutMs: 30000 });
      if (twnRes.ok) {
        const twnJson = (await twnRes.json()) as {
          series?: {
            docs?: Array<{
              dimensions: { 'weo-subject'?: string };
              period?: string[];
              periods?: string[];
              value?: (number | null)[];
              values?: (number | null)[];
            }>;
          };
        };
        const twnMap: Record<string, Record<number, number>> = {};
        for (const doc of twnJson.series?.docs || []) {
          const subj = doc.dimensions['weo-subject'] || '';
          twnMap[subj] = {};
          const periods = doc.period || doc.periods || [];
          const values = doc.value || doc.values || [];
          for (let i = 0; i < periods.length; i++) {
            const y = parseInt(periods[i], 10);
            const val = values[i];
            if (y >= START_YEAR && y <= END_YEAR && val != null) {
              twnMap[subj][y] = val;
            }
          }
        }

        data.gdp_ppp_kd.TWN = {};
        data.gdp_pcap_ppp_kd.TWN = {};
        data.cpi.TWN = {};

        for (let y = START_YEAR; y <= END_YEAR; y++) {
          const perCapita = twnMap.NGDPRPPPPC?.[y];
          const lp = twnMap.LP?.[y];
          if (perCapita != null) {
            data.gdp_pcap_ppp_kd.TWN[y] = Math.round(perCapita);
            if (lp != null) {
              data.gdp_ppp_kd.TWN[y] = perCapita * lp * 1e6;
            }
          }
          const cpiVal = twnMap.PCPI?.[y];
          if (cpiVal != null) {
            data.cpi.TWN[y] = cpiVal;
          }
        }
      }
    } catch (e) {
      logger.warn(`IMF WEO Taiwan query warning: ${e}`);
    }

    await writeJson(MACRO_CACHE_FILE, data, 0);
    logger.debug('Global macroeconomic data cached successfully.');
    return data;
  } catch (err) {
    logger.warn(`World Bank query failed (${err}).`);
    if (await fileExists(MACRO_CACHE_FILE)) {
      return await readJson<MacroData>(MACRO_CACHE_FILE);
    }
    throw err;
  }
}

/** Parses OWID Energy CSV text across all sovereign countries and regional aggregates. */
function parseOwidCsvGlobal(csvText: string): {
  electricity_twh: Record<string, Record<number, number>>;
  solar_wind_twh: Record<string, Record<number, number>>;
  elec_per_capita_kwh: Record<string, Record<number, number>>;
} {
  const electricity_twh: Record<string, Record<number, number>> = {};
  const solar_wind_twh: Record<string, Record<number, number>> = {};
  const elec_per_capita_kwh: Record<string, Record<number, number>> = {};

  const lines = csvText.split('\n');
  if (lines.length === 0) return { electricity_twh, solar_wind_twh, elec_per_capita_kwh };

  const header = lines[0].split(',').map((h) => h.trim());
  const cIdx = header.indexOf('country');
  const isoIdx = header.indexOf('iso_code');
  const yIdx = header.indexOf('year');
  const eleIdx = header.indexOf('electricity_generation');
  const solIdx = header.indexOf('solar_electricity');
  const winIdx = header.indexOf('wind_electricity');
  const capIdx = header.indexOf('per_capita_electricity');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const countryName = cols[cIdx]?.trim();
    const iso = cols[isoIdx]?.trim();
    const year = parseInt(cols[yIdx]?.trim(), 10);
    if (Number.isNaN(year) || year < START_YEAR || year > END_YEAR) continue;

    let entityCode = '';
    if (iso && iso.length === 3 && !iso.startsWith('OWID')) {
      entityCode = iso;
    } else if (countryName === 'European Union (27)') {
      entityCode = 'EUU';
    }

    if (!entityCode || EXCLUDED_ENTITIES.has(entityCode)) continue;

    const eleVal = parseFloat(cols[eleIdx]?.trim());
    if (!Number.isNaN(eleVal)) {
      if (!electricity_twh[entityCode]) electricity_twh[entityCode] = {};
      electricity_twh[entityCode][year] = Math.round(eleVal * 10) / 10;
    }

    const solVal = parseFloat(cols[solIdx]?.trim()) || 0;
    const winVal = parseFloat(cols[winIdx]?.trim()) || 0;
    if (solVal > 0 || winVal > 0) {
      if (!solar_wind_twh[entityCode]) solar_wind_twh[entityCode] = {};
      solar_wind_twh[entityCode][year] = Math.round((solVal + winVal) * 10) / 10;
    }

    const capVal = parseFloat(cols[capIdx]?.trim());
    if (!Number.isNaN(capVal)) {
      if (!elec_per_capita_kwh[entityCode]) elec_per_capita_kwh[entityCode] = {};
      elec_per_capita_kwh[entityCode][year] = Math.round(capVal * 10) / 10;
    }
  }

  return { electricity_twh, solar_wind_twh, elec_per_capita_kwh };
}

/** Fetches UN Comtrade reporter area mappings from static reference API. */
async function fetchComtradeReporters(): Promise<Record<number, string>> {
  const logger = getLogger();
  if (await fileExists(REPORTERS_CACHE_FILE)) {
    try {
      const cached = await readJson<Record<number, string>>(REPORTERS_CACHE_FILE);
      if (Object.keys(cached).length > 0) {
        return cached;
      }
    } catch {
      // ignore
    }
  }

  const map: Record<number, string> = {
    97: 'EUU', // European Union
    156: 'CHN',
    842: 'USA',
    392: 'JPN',
    410: 'KOR',
    490: 'TWN',
    699: 'IND',
    643: 'RUS',
    276: 'DEU',
  };

  try {
    const res = await fetchWithRetry('https://comtradeapi.un.org/files/v1/app/reference/Reporters.json', { retries: 2, timeoutMs: 20000 });
    if (res.ok) {
      const json = (await res.json()) as { results?: Array<{ id?: number; reporterCodeIsoAlpha3?: string }> };
      for (const item of json.results || []) {
        if (item.id === 97) {
          map[97] = 'EUU';
        } else if (item.id && item.reporterCodeIsoAlpha3 && item.reporterCodeIsoAlpha3.length === 3) {
          map[item.id] = item.reporterCodeIsoAlpha3;
        }
      }
      await writeJson(REPORTERS_CACHE_FILE, map, 0);
    }
  } catch (err) {
    logger.warn(`Failed to fetch Comtrade reporters reference (${err}). Using built-in mappings.`);
  }

  return map;
}

/** Fetches physical industrial scale, electricity, and machinery trade turnover. */
async function fetchPhysicalAndMachineryData(forceUpdate = false): Promise<PhysicalData> {
  const logger = getLogger();
  let existingData: Partial<PhysicalData> = {};
  if (await fileExists(PHYSICAL_CACHE_FILE)) {
    try {
      existingData = await readJson<PhysicalData>(PHYSICAL_CACHE_FILE);
    } catch {
      // ignore
    }
  }

  const data: PhysicalData = {
    chapter84_nominal: existingData.chapter84_nominal || {},
    electricity_twh: existingData.electricity_twh || {},
    solar_wind_twh: existingData.solar_wind_twh || {},
    elec_per_capita_kwh: existingData.elec_per_capita_kwh || {},
  };

  if (data.chapter84_nominal.EUR && !data.chapter84_nominal.EUU) {
    data.chapter84_nominal.EUU = data.chapter84_nominal.EUR;
    delete data.chapter84_nominal.EUR;
  }
  delete data.electricity_twh.EUR;
  delete data.solar_wind_twh.EUR;
  delete data.elec_per_capita_kwh.EUR;

  // 1. OWID Energy Data
  if (forceUpdate || !existingData.electricity_twh || Object.keys(existingData.electricity_twh).length < 20) {
    logger.debug('Fetching OWID Energy (Electricity, Solar/Wind, Per-Capita)...');
    try {
      const owidUrl = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
      const res = await fetchWithRetry(owidUrl, { retries: 2, timeoutMs: 30000 });
      if (res.ok) {
        const csvText = await res.text();
        const parsed = parseOwidCsvGlobal(csvText);
        data.electricity_twh = parsed.electricity_twh;
        data.solar_wind_twh = parsed.solar_wind_twh;
        data.elec_per_capita_kwh = parsed.elec_per_capita_kwh;
      }
    } catch (err) {
      logger.warn(`OWID energy fetch error (${err}). Falling back to cached energy data.`);
    }
  }

  // 2. UN Comtrade Chapter 84 Machinery Trade
  const comtradeReporters = await fetchComtradeReporters();
  const comtradeKey = process.env.COMTRADE_API_KEY || '';
  const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};
  const currentYear = new Date().getFullYear();

  let neededFetch = false;
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    // Check if this year already has diverse reporters in cache (> 10 countries)
    const hasYearData = Object.values(data.chapter84_nominal).filter((cDict) => (cDict[y] ?? cDict[String(y)]) != null).length >= 10;
    if (!forceUpdate && y < currentYear && hasYearData) {
      continue;
    }

    neededFetch = true;
    try {
      logger.debug(`Fetching UN Comtrade Chapter 84 (${y})...`);
      const comtradeUrl = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?period=${y}&cmdCode=84&flowCode=M,X&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0`;
      const res = await fetchWithRetry(comtradeUrl, { retries: 2, timeoutMs: 45000, headers: comtradeHeaders });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ reporterCode: number; primaryValue: number }> };
        const sums: Record<string, number> = {};
        for (const row of json.data || []) {
          const iso3 = comtradeReporters[row.reporterCode];
          if (iso3 && row.primaryValue > 0 && !EXCLUDED_ENTITIES.has(iso3)) {
            sums[iso3] = (sums[iso3] || 0) + row.primaryValue;
          }
        }
        for (const [c, val] of Object.entries(sums)) {
          if (!data.chapter84_nominal[c]) data.chapter84_nominal[c] = {};
          data.chapter84_nominal[c][y] = Math.round((val / 1e9) * 100) / 100;
        }
        logger.debug(`UN Comtrade Chapter 84 (${y}): fetched ${Object.keys(sums).length} reporters`);
      }
    } catch (e) {
      logger.warn(`UN Comtrade Chapter 84 (${y}) warning: ${e}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  if (neededFetch || forceUpdate) {
    await writeJson(PHYSICAL_CACHE_FILE, data, 0);
    logger.debug('Physical Industrial & Machinery data cached successfully.');
  }

  return data;
}

/** Resolves the latest available non-null value in a time series looking backwards. */
function getLatestVal(dict: Record<number | string, number | undefined>): number {
  for (let y = END_YEAR; y >= START_YEAR; y--) {
    const v = dict[y] ?? dict[String(y)];
    if (v != null && !Number.isNaN(v)) return v;
  }
  return 0;
}

/** Runs the World ETL Pipeline. Deflates machinery and MVA by US CPI, computes rankings, and exports to site/src/data/world.json. */
export async function runWorldPipeline(forceUpdate = false, verbose?: boolean): Promise<WorldDataset> {
  return runWithLogger(
    'world',
    async () => {
      const logger = getLogger();
      logger.start('Starting World ETL pipeline');

      await ensureDir(MACRO_CACHE_FILE);

      const macroRaw = await fetchMacroDataWorldBank(forceUpdate);
      const physicalData = await fetchPhysicalAndMachineryData(forceUpdate);

      const years: number[] = [];
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        years.push(y);
      }

      const nationalCpis = macroRaw.cpi || {};
      const cpiUs: Record<string | number, number> = nationalCpis.USA || {};
      const cpi2021 = Number(cpiUs[2021] ?? cpiUs['2021'] ?? 124.27);
      const usDeflator: Record<number, number> = {};
      for (const y of years) {
        const cVal = Number(cpiUs[y] ?? cpiUs[String(y)] ?? cpi2021);
        usDeflator[y] = cpi2021 / cVal;
      }

      // Real GDP PPP (Trillions)
      const gdpPppTrillions: Record<string, Record<number, number>> = {};
      for (const [c, series] of Object.entries(macroRaw.gdp_ppp_kd || {})) {
        if (EXCLUDED_ENTITIES.has(c)) continue;
        gdpPppTrillions[c] = {};
        for (const [yStr, val] of Object.entries(series)) {
          const y = parseInt(yStr, 10);
          gdpPppTrillions[c][y] = val / 1e12;
        }
      }

      // Real Chapter 84 Machinery (Billion USD constant 2021)
      const ch84Real: Record<string, Record<number, number>> = {};
      for (const [c, series] of Object.entries(physicalData.chapter84_nominal || {})) {
        if (EXCLUDED_ENTITIES.has(c)) continue;
        ch84Real[c] = {};
        for (const y of years) {
          const valNom = Number(series[y] ?? series[String(y)] ?? 0);
          if (valNom > 0) {
            ch84Real[c][y] = Math.round(valNom * usDeflator[y] * 10) / 10;
          }
        }
      }

      const aggregateSet = new Set(macroRaw.aggregates || []);
      const nonEuAggregates = new Set([...aggregateSet].filter((c) => c !== 'EUU'));

      function isCountry(code: string): boolean {
        if (code === 'EUU' || code === 'EU') return false;
        if (nonEuAggregates.has(code) || EXCLUDED_ENTITIES.has(code)) return false;
        return true;
      }

      function formatMetric(rawDict: Record<string, Record<number | string, number | undefined>>, scale = 1.0, decimals = 2): WorldChartMetricData {
        const entityLatest = new Map<string, number>();
        for (const [code, series] of Object.entries(rawDict)) {
          if (!isCountry(code) && code !== 'EUU') continue;
          const lv = getLatestVal(series);
          if (lv > 0) {
            entityLatest.set(code, lv);
          }
        }

        const sortedEntities = Array.from(entityLatest.keys())
          .sort((a, b) => (entityLatest.get(b) || 0) - (entityLatest.get(a) || 0))
          .slice(0, 20);

        const seriesByEntity: Record<string, (number | null)[]> = {};
        for (const c of sortedEntities) {
          const cDict = rawDict[c];
          if (!cDict) continue;
          const values: (number | null)[] = [];
          let hasAny = false;
          for (const y of years) {
            const val = cDict[y] ?? cDict[String(y)];
            if (val != null && !Number.isNaN(val)) {
              hasAny = true;
              const factor = 10 ** decimals;
              values.push(Math.round(val * scale * factor) / factor);
            } else {
              values.push(null);
            }
          }
          if (hasAny) {
            const regionCode = resolveRegionCode(c);
            if (!seriesByEntity[regionCode]) {
              seriesByEntity[regionCode] = values;
            }
          }
        }

        return {
          series: seriesByEntity,
        };
      }

      const dataset: WorldDataset = {
        years,
        charts: {
          gdpPpp: formatMetric(gdpPppTrillions, 1.0, 2),
          gdpPerCapitaPpp: formatMetric(macroRaw.gdp_pcap_ppp_kd || {}, 1.0, 0),
          machineryTurnover: formatMetric(ch84Real, 1.0, 1),
          electricityGeneration: formatMetric(physicalData.electricity_twh || {}, 1.0, 1),
          cleanPower: formatMetric(physicalData.solar_wind_twh || {}, 1.0, 1),
          electricityPerCapita: formatMetric(physicalData.elec_per_capita_kwh || {}, 1.0, 0),
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('world');
      logger.success(`Exported world dataset (${years.length} years, 6 macroeconomic & industrial charts)`);
      return dataset;
    },
    verbose,
  );
}

export { runWorldPipeline as runWorldEconomicPipeline };

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWorldPipeline().catch((err) => {
    getLogger('world').error('Fatal error running World pipeline:', err);
    process.exit(1);
  });
}
