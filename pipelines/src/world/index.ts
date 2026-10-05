import type { WorldChartMetricData, WorldDataset } from '@graphs/types';
import { exportDataset, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchHeadMeta, fetchWithRetry, isRemoteMetaEqual, type RemoteFileMeta } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { range, round } from '@/utils/math';
import { resolveRegionCode } from '@/utils/region';

const DATA_FILE = getPipelineDataPath('world');

const OWID_ENERGY_URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const WDI_SOURCE_URL = 'https://api.worldbank.org/v2/sources/2?format=json';

const START_YEAR = 1990;
const CURRENT_YEAR = new Date().getFullYear();

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

interface WorldPipelineCache {
  meta?: {
    wdiLastUpdated?: string | null;
    owid?: RemoteFileMeta | null;
  };
  macro: MacroData;
  physical: PhysicalData;
  reporters: Record<number, string>;
  dataset: WorldDataset;
}

/** Fetches latest WDI database release date from World Bank sources API. */
async function fetchWdiLastUpdated(): Promise<string | null> {
  try {
    const res = await fetchWithRetry(WDI_SOURCE_URL, { retries: 2, timeoutMs: 15000 });
    if (!res.ok) return null;
    const json = (await res.json()) as [unknown, Array<{ id?: string; lastupdated?: string }>];
    return json?.[1]?.[0]?.lastupdated || null;
  } catch {
    return null;
  }
}

/** Loads consolidated data.json cache. */
async function loadWorldCache(): Promise<WorldPipelineCache | null> {
  if (await fileExists(DATA_FILE)) {
    try {
      return await readJson<WorldPipelineCache>(DATA_FILE);
    } catch {
      // ignore corrupt cache
    }
  }
  return null;
}

/** Fetches global macroeconomic series from World Bank API & IMF WEO. */
async function fetchMacroDataWorldBank(existingMacro?: MacroData, forceUpdate = false): Promise<MacroData> {
  const logger = getLogger();
  const hasMacroRange = Boolean(existingMacro?.gdp_ppp_kd?.USA?.[START_YEAR] && (existingMacro?.gdp_ppp_kd?.USA?.[CURRENT_YEAR] || existingMacro?.gdp_ppp_kd?.USA?.[CURRENT_YEAR - 1]));
  if (!forceUpdate && hasMacroRange && existingMacro?.gdp_ppp_kd && Object.keys(existingMacro.gdp_ppp_kd).length > 0) {
    logger.debug('Using cached World Bank & IMF macroeconomic data');
    return existingMacro;
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
      const url = `https://api.worldbank.org/v2/country/all/indicator/${ind.code}?date=${START_YEAR}:${CURRENT_YEAR}&format=json&per_page=16000`;
      const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 45000 });
      if (res.ok) {
        const json = (await res.json()) as [unknown, Array<{ countryiso3code?: string; date?: string; value?: number | null }>];
        const rows = json[1] || [];
        for (const row of rows) {
          const code = row.countryiso3code;
          if (code?.length !== 3 || EXCLUDED_ENTITIES.has(code)) continue;
          const year = parseInt(row.date || '', 10);
          const val = row.value;
          if (!Number.isNaN(year) && year >= START_YEAR && year <= CURRENT_YEAR && val != null && !Number.isNaN(val)) {
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
            if (y >= START_YEAR && y <= CURRENT_YEAR && val != null) {
              twnMap[subj][y] = val;
            }
          }
        }

        data.gdp_ppp_kd.TWN = {};
        data.gdp_pcap_ppp_kd.TWN = {};
        data.cpi.TWN = {};

        for (let y = START_YEAR; y <= CURRENT_YEAR; y++) {
          const perCapita = twnMap.NGDPRPPPPC?.[y];
          const lp = twnMap.LP?.[y];
          if (perCapita != null) {
            data.gdp_pcap_ppp_kd.TWN[y] = round(perCapita, 0);
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

    return data;
  } catch (err) {
    logger.warn(`World Bank query failed (${err}).`);
    if (existingMacro?.gdp_ppp_kd && Object.keys(existingMacro.gdp_ppp_kd).length > 0) {
      return existingMacro;
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
    if (Number.isNaN(year) || year < START_YEAR || year > CURRENT_YEAR) continue;

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
      electricity_twh[entityCode][year] = round(eleVal, 1);
    }

    const solVal = parseFloat(cols[solIdx]?.trim()) || 0;
    const winVal = parseFloat(cols[winIdx]?.trim()) || 0;
    if (solVal > 0 || winVal > 0) {
      if (!solar_wind_twh[entityCode]) solar_wind_twh[entityCode] = {};
      solar_wind_twh[entityCode][year] = round(solVal + winVal, 1);
    }

    const capVal = parseFloat(cols[capIdx]?.trim());
    if (!Number.isNaN(capVal)) {
      if (!elec_per_capita_kwh[entityCode]) elec_per_capita_kwh[entityCode] = {};
      elec_per_capita_kwh[entityCode][year] = round(capVal, 1);
    }
  }

  return { electricity_twh, solar_wind_twh, elec_per_capita_kwh };
}

/** Fetches UN Comtrade reporter area mappings from static reference API. */
async function fetchComtradeReporters(existingReporters?: Record<number, string>): Promise<Record<number, string>> {
  if (existingReporters && Object.keys(existingReporters).length > 20) {
    return existingReporters;
  }

  const logger = getLogger();
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
    }
  } catch (err) {
    logger.warn(`Failed to fetch Comtrade reporters reference (${err}). Using built-in mappings.`);
  }

  return map;
}

/** Fetches physical industrial scale, electricity, and machinery trade turnover. */
async function fetchPhysicalAndMachineryData(existingPhysical?: PhysicalData, comtradeReporters?: Record<number, string>, owidChanged = true, forceUpdate = false): Promise<PhysicalData> {
  const logger = getLogger();
  const data: PhysicalData = {
    chapter84_nominal: existingPhysical?.chapter84_nominal || {},
    electricity_twh: existingPhysical?.electricity_twh || {},
    solar_wind_twh: existingPhysical?.solar_wind_twh || {},
    elec_per_capita_kwh: existingPhysical?.elec_per_capita_kwh || {},
  };

  if (data.chapter84_nominal.EUR && !data.chapter84_nominal.EUU) {
    data.chapter84_nominal.EUU = data.chapter84_nominal.EUR;
    delete data.chapter84_nominal.EUR;
  }
  delete data.electricity_twh.EUR;
  delete data.solar_wind_twh.EUR;
  delete data.elec_per_capita_kwh.EUR;

  // 1. OWID Energy Data
  const hasEnergyRange = Boolean(existingPhysical?.electricity_twh?.USA?.[START_YEAR]);
  if (owidChanged || forceUpdate || !hasEnergyRange || !existingPhysical?.electricity_twh || Object.keys(existingPhysical.electricity_twh).length < 20) {
    logger.debug('Fetching OWID Energy (Electricity, Solar/Wind, Per-Capita)...');
    try {
      const res = await fetchWithRetry(OWID_ENERGY_URL, { retries: 2, timeoutMs: 30000 });
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
  const reporters = comtradeReporters || (await fetchComtradeReporters());
  const comtradeKey = process.env.COMTRADE_API_KEY || '';
  const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};
  const comtradeDelay = comtradeKey ? 1200 : 3500;

  for (let y = START_YEAR; y <= CURRENT_YEAR; y++) {
    // Check if this year already has diverse reporters in cache (> 10 countries)
    const hasYearData = Object.values(data.chapter84_nominal).filter((cDict) => (cDict[y] ?? cDict[String(y)]) != null).length >= 10;
    if (!forceUpdate && y < CURRENT_YEAR && hasYearData) {
      continue;
    }

    try {
      logger.debug(`Fetching UN Comtrade Chapter 84 (${y})...`);
      const comtradeUrl = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?period=${y}&cmdCode=84&flowCode=M,X&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0`;
      const res = await fetchWithRetry(comtradeUrl, { retries: 3, backoffMs: 4000, timeoutMs: 45000, headers: comtradeHeaders });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ reporterCode: number; primaryValue: number }> };
        const sums: Record<string, number> = {};
        for (const row of json.data || []) {
          const iso3 = reporters[row.reporterCode];
          if (iso3 && row.primaryValue > 0 && !EXCLUDED_ENTITIES.has(iso3)) {
            sums[iso3] = (sums[iso3] || 0) + row.primaryValue;
          }
        }
        for (const [c, val] of Object.entries(sums)) {
          if (!data.chapter84_nominal[c]) data.chapter84_nominal[c] = {};
          data.chapter84_nominal[c][y] = round(val / 1e9, 2);
        }
        logger.debug(`UN Comtrade Chapter 84 (${y}): fetched ${Object.keys(sums).length} reporters`);
      }
    } catch (e) {
      logger.warn(`UN Comtrade Chapter 84 (${y}) warning: ${e}`);
    }
    await new Promise((resolve) => setTimeout(resolve, comtradeDelay));
  }

  return data;
}

/** Resolves the latest available non-null value in a time series looking backwards. */
function getLatestVal(dict: Record<number | string, number | undefined>, endYear: number): number {
  for (let y = endYear; y >= START_YEAR; y--) {
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

      const cache = await loadWorldCache();
      const hasValidDataset =
        Boolean(cache?.dataset?.years?.length) &&
        cache?.dataset?.years?.[0] === START_YEAR &&
        (cache?.dataset?.years?.[cache.dataset.years.length - 1] ?? 0) >= CURRENT_YEAR - 1 &&
        Boolean(cache?.dataset?.charts?.gdpPpp?.series);

      let remoteWdiDate: string | null = null;
      let remoteOwidMeta: RemoteFileMeta | null = null;
      let wdiChanged = true;
      let owidChanged = true;

      // Fast check: verify if remote files/databases are unchanged via HTTP metadata
      if (!forceUpdate && hasValidDataset && cache?.meta) {
        logger.debug('Checking World Bank WDI and OWID metadata...');
        [remoteWdiDate, remoteOwidMeta] = await Promise.all([fetchWdiLastUpdated(), fetchHeadMeta(OWID_ENERGY_URL)]);

        const networkFailed = remoteWdiDate === null && remoteOwidMeta === null;
        if (networkFailed) {
          logger.warn('Remote data sources unreachable (offline). Using cached dataset.');
          await exportDataset('world', cache.dataset);
          return cache.dataset;
        }

        wdiChanged = remoteWdiDate == null || remoteWdiDate !== cache.meta.wdiLastUpdated;
        owidChanged = !isRemoteMetaEqual(cache.meta.owid, remoteOwidMeta);

        if (!wdiChanged && !owidChanged) {
          logger.info('All source metadata matches remote (WDI release & OWID ETag). Using cached dataset.');
          await exportDataset('world', cache.dataset);
          return cache.dataset;
        }

        logger.info('Remote sources updated upstream. Refreshing dataset...');
      }

      const reporters = await fetchComtradeReporters(cache?.reporters);
      const macroRaw = await fetchMacroDataWorldBank(cache?.macro, forceUpdate || wdiChanged);
      const physicalData = await fetchPhysicalAndMachineryData(cache?.physical, reporters, owidChanged, forceUpdate);

      // Determine latest available year across fetched sources (data-driven)
      let maxYear = START_YEAR;
      for (const series of Object.values(macroRaw.gdp_ppp_kd || {})) {
        for (const yStr of Object.keys(series)) {
          const y = parseInt(yStr, 10);
          if (y > maxYear && y <= CURRENT_YEAR) maxYear = y;
        }
      }
      for (const series of Object.values(physicalData.electricity_twh || {})) {
        for (const yStr of Object.keys(series)) {
          const y = parseInt(yStr, 10);
          if (y > maxYear && y <= CURRENT_YEAR) maxYear = y;
        }
      }
      for (const series of Object.values(physicalData.chapter84_nominal || {})) {
        for (const yStr of Object.keys(series)) {
          const y = parseInt(yStr, 10);
          if (y > maxYear && y <= CURRENT_YEAR) maxYear = y;
        }
      }
      const endYear = maxYear;
      const years = range(START_YEAR, endYear);

      const nationalCpis = macroRaw.cpi || {};
      const cpiUs: Record<string | number, number> = nationalCpis.USA || {};
      const cpi2021 = Number(cpiUs[2021] ?? cpiUs['2021'] ?? 124.27);
      const usDeflator: Record<number, number> = {};
      let lastKnownCpi = cpi2021;
      for (const y of years) {
        const cVal = Number(cpiUs[y] ?? cpiUs[String(y)] ?? lastKnownCpi);
        if (cVal > 0) lastKnownCpi = cVal;
        usDeflator[y] = cpi2021 / lastKnownCpi;
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
            ch84Real[c][y] = round(valNom * usDeflator[y], 1);
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
          const lv = getLatestVal(series, endYear);
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
              values.push(round(val * scale, decimals));
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

      await writeJson(
        DATA_FILE,
        {
          meta: {
            wdiLastUpdated: remoteWdiDate || cache?.meta?.wdiLastUpdated || '2026-07-13',
            owid: remoteOwidMeta || cache?.meta?.owid || null,
          },
          macro: macroRaw,
          physical: physicalData,
          reporters,
          dataset,
        },
        0,
      );
      await exportDataset('world', dataset);
      logger.success(`Exported world dataset (${years.length} years, 6 macroeconomic & industrial charts)`);
      return dataset;
    },
    verbose,
  );
}

if (import.meta.main) {
  runWorldPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('world').error('Fatal error running World pipeline:', err);
    process.exit(1);
  });
}
