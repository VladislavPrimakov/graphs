import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorldChartMetricData, WorldEconomicDataset } from '@/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';

try {
  process.loadEnvFile?.();
} catch {
  // .env may not exist in CI or certain environments
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const MACRO_CACHE_FILE = path.join(CACHE_DIR, 'macro_data_dbnomics.json');
const PHYSICAL_CACHE_FILE = path.join(CACHE_DIR, 'physical_industrial_data.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/world-economic.json');

const START_YEAR = 2000;
const END_YEAR = 2024;

export const ENTITIES: Record<string, { name: string }> = {
  CHN: { name: 'China' },
  USA: { name: 'USA' },
  EUU: { name: 'Europe' },
  JPN: { name: 'Japan' },
  KOR: { name: 'South Korea' },
  TWN: { name: 'Taiwan' },
  IND: { name: 'India' },
  RUS: { name: 'Russia' },
};

const UN_COMTRADE_REPORTERS: Record<string, number> = {
  CHN: 156, // China
  USA: 842, // USA
  EUR: 97, // European Union
  JPN: 392, // Japan
  KOR: 410, // Republic of Korea
  TWN: 490, // Taiwan
  IND: 699, // India
  RUS: 643, // Russian Federation
};

const TARGET_MAP: Record<string, string> = {
  CHN: 'China',
  USA: 'United States',
  EUR: 'European Union (27)',
  IND: 'India',
  RUS: 'Russia',
  JPN: 'Japan',
  KOR: 'South Korea',
  TWN: 'Taiwan',
};

interface MacroData {
  gdp_ppp_kd: Record<string, Record<number, number>>;
  gdp_pcap_ppp_kd: Record<string, Record<number, number>>;
  cpi: Record<string, Record<number, number>>;
}

interface PhysicalData {
  chapter84_nominal: Record<string, Record<number | string, number>>;
  electricity_twh: Record<string, Record<number | string, number>>;
  mva_trillions: Record<string, Record<number | string, number>>;
  solar_wind_twh: Record<string, Record<number | string, number>>;
  elec_per_capita_kwh: Record<string, Record<number | string, number>>;
}

/** Fetches macroeconomic series from DBnomics Open API (WB WDI, IMF WEO, Eurostat). */
async function fetchMacroDataDbnomics(forceUpdate = false): Promise<MacroData> {
  const logger = getLogger();
  if (!forceUpdate && (await fileExists(MACRO_CACHE_FILE))) {
    try {
      const cached = await readJson<MacroData>(MACRO_CACHE_FILE);
      if (cached.gdp_pcap_ppp_kd && Object.keys(cached.gdp_pcap_ppp_kd).length > 0) {
        logger.debug(`Loaded Macro data from cache: ${path.basename(MACRO_CACHE_FILE)}`);
        return cached;
      }
    } catch {
      // ignore
    }
  }

  logger.debug('Fetching Macroeconomic series from DBnomics Open API...');
  const wbCountries = ['CHN', 'USA', 'KOR', 'JPN', 'IND', 'RUS', 'EUU'];
  const data: MacroData = { gdp_ppp_kd: {}, gdp_pcap_ppp_kd: {}, cpi: {} };

  try {
    // 1. World Bank WDI (GDP PPP, GDP per capita PPP & CPI)
    const wbUrl = `https://api.db.nomics.world/v22/series/WB/WDI?observations=1&dimensions=${encodeURIComponent(
      JSON.stringify({ indicator: ['NY.GDP.MKTP.PP.KD', 'NY.GDP.PCAP.PP.KD', 'FP.CPI.TOTL'], country: wbCountries }),
    )}&limit=1000`;

    const wbRes = await fetchWithRetry(wbUrl, { retries: 2, timeoutMs: 30000 });
    if (wbRes.ok) {
      const wbJson = (await wbRes.json()) as {
        series?: {
          docs?: Array<{
            dimensions: { indicator: string; country: string };
            period?: string[];
            periods?: string[];
            value?: (number | null)[];
            values?: (number | null)[];
          }>;
        };
      };
      const docs = wbJson.series?.docs || [];
      for (const doc of docs) {
        const indCode = doc.dimensions.indicator;
        let ind: 'gdp_ppp_kd' | 'gdp_pcap_ppp_kd' | 'cpi' = 'cpi';
        if (indCode === 'NY.GDP.MKTP.PP.KD') ind = 'gdp_ppp_kd';
        else if (indCode === 'NY.GDP.PCAP.PP.KD') ind = 'gdp_pcap_ppp_kd';
        else if (indCode === 'FP.CPI.TOTL') ind = 'cpi';

        const c = doc.dimensions.country;
        if (!data[ind][c]) data[ind][c] = {};
        const periods = doc.period || doc.periods || [];
        const values = doc.value || doc.values || [];
        for (let i = 0; i < periods.length; i++) {
          const y = parseInt(periods[i], 10);
          const val = values[i];
          if (y >= START_YEAR && y <= END_YEAR && val != null && !Number.isNaN(val)) {
            data[ind][c][y] = val;
          }
        }
      }
    }

    // 2. IMF WEO (Taiwan & Growth / CPI projections)
    const imfCountries = ['CHN', 'USA', 'KOR', 'JPN', 'IND', 'RUS', 'TWN'];
    const imfUrl = `https://api.db.nomics.world/v22/series/IMF/WEO:2024-10?observations=1&dimensions=${encodeURIComponent(
      JSON.stringify({ 'weo-country': imfCountries, 'weo-subject': ['NGDPRPPPPC', 'LP', 'NGDP_RPCH', 'PCPIPCH', 'PCPI'] }),
    )}&limit=1000`;

    const growth2024: Record<string, number> = {};
    const cpiRate2024: Record<string, number> = {};
    const twnData: Record<string, Record<number, number>> = {};

    try {
      const imfRes = await fetchWithRetry(imfUrl, { retries: 2, timeoutMs: 30000 });
      if (imfRes.ok) {
        const imfJson = (await imfRes.json()) as {
          series?: {
            docs?: Array<{
              dimensions: { 'weo-country'?: string; 'weo-subject'?: string };
              period?: string[];
              periods?: string[];
              value?: (number | null)[];
              values?: (number | null)[];
            }>;
          };
        };
        const docs = imfJson.series?.docs || [];
        for (const doc of docs) {
          const c = doc.dimensions['weo-country'] || '';
          const subj = doc.dimensions['weo-subject'] || '';
          const periods = doc.period || doc.periods || [];
          const values = doc.value || doc.values || [];
          if (c === 'TWN') {
            if (!twnData[subj]) twnData[subj] = {};
            for (let i = 0; i < periods.length; i++) {
              const y = parseInt(periods[i], 10);
              const val = values[i];
              if (y >= START_YEAR && y <= END_YEAR && val != null) {
                twnData[subj][y] = val;
              }
            }
          }
          const idx2024 = periods.indexOf('2024');
          if (idx2024 !== -1 && values[idx2024] != null) {
            if (subj === 'NGDP_RPCH') growth2024[c] = values[idx2024]!;
            if (subj === 'PCPIPCH') cpiRate2024[c] = values[idx2024]!;
          }
        }
      }
    } catch (e) {
      logger.warn(`IMF WEO query: ${e}`);
    }

    // Process Taiwan
    data.gdp_ppp_kd.TWN = {};
    data.gdp_pcap_ppp_kd.TWN = {};
    data.cpi.TWN = {};
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const perCapita = twnData.NGDPRPPPPC?.[y];
      const lp = twnData.LP?.[y];
      if (perCapita != null) {
        data.gdp_pcap_ppp_kd.TWN[y] = Math.round(perCapita);
        if (lp != null) {
          data.gdp_ppp_kd.TWN[y] = perCapita * lp * 1e6;
        }
      }
      const cpiVal = twnData.PCPI?.[y];
      if (cpiVal != null) {
        data.cpi.TWN[y] = cpiVal;
      }
    }

    // Apply 2024 growth & inflation extrapolation if 2024 is missing from WB
    for (const c of wbCountries) {
      if (data.gdp_ppp_kd[c] && !data.gdp_ppp_kd[c][2024] && data.gdp_ppp_kd[c][2023]) {
        const g = growth2024[c];
        if (g != null) {
          data.gdp_ppp_kd[c][2024] = data.gdp_ppp_kd[c][2023] * (1.0 + g / 100.0);
        }
      }
      if (data.gdp_pcap_ppp_kd[c] && !data.gdp_pcap_ppp_kd[c][2024] && data.gdp_pcap_ppp_kd[c][2023]) {
        const g = growth2024[c];
        if (g != null) {
          data.gdp_pcap_ppp_kd[c][2024] = Math.round(data.gdp_pcap_ppp_kd[c][2023] * (1.0 + g / 100.0));
        }
      }
      if (data.cpi[c] && !data.cpi[c][2024] && data.cpi[c][2023]) {
        const inf = cpiRate2024[c];
        if (inf != null) {
          data.cpi[c][2024] = data.cpi[c][2023] * (1.0 + inf / 100.0);
        }
      }
    }

    await writeJson(MACRO_CACHE_FILE, data, 0);
    logger.debug('Macroeconomic data cached from DBnomics API successfully.');
    return data;
  } catch (err) {
    logger.warn(`DBnomics query failed (${err}).`);
    if (await fileExists(MACRO_CACHE_FILE)) {
      return await readJson<MacroData>(MACRO_CACHE_FILE);
    }
    throw err;
  }
}

/** Parses OWID CSV text into clean metrics without external heavy parser dependencies. */
function parseOwidCsv(
  csvText: string,
  targetMap: Record<string, string>,
): {
  electricity_twh: Record<string, Record<number, number>>;
  solar_wind_twh: Record<string, Record<number, number>>;
  elec_per_capita_kwh: Record<string, Record<number, number>>;
} {
  const result = {
    electricity_twh: Object.fromEntries(Object.keys(targetMap).map((k) => [k, {} as Record<number, number>])),
    solar_wind_twh: Object.fromEntries(Object.keys(targetMap).map((k) => [k, {} as Record<number, number>])),
    elec_per_capita_kwh: Object.fromEntries(Object.keys(targetMap).map((k) => [k, {} as Record<number, number>])),
  };

  const invTarget: Record<string, string> = {};
  for (const [code, name] of Object.entries(targetMap)) {
    invTarget[name] = code;
  }

  const lines = csvText.split('\n');
  if (lines.length === 0) return result;

  const header = lines[0].split(',').map((h) => h.trim());
  const cIdx = header.indexOf('country');
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
    const code = invTarget[countryName];
    if (!code) continue;

    const year = parseInt(cols[yIdx]?.trim(), 10);
    if (Number.isNaN(year) || year < START_YEAR || year > END_YEAR) continue;

    const eleVal = parseFloat(cols[eleIdx]?.trim());
    if (!Number.isNaN(eleVal)) {
      result.electricity_twh[code][year] = Math.round(eleVal * 10) / 10;
    }

    const solVal = parseFloat(cols[solIdx]?.trim()) || 0;
    const winVal = parseFloat(cols[winIdx]?.trim()) || 0;
    result.solar_wind_twh[code][year] = Math.round((solVal + winVal) * 10) / 10;

    const capVal = parseFloat(cols[capIdx]?.trim());
    if (!Number.isNaN(capVal)) {
      result.elec_per_capita_kwh[code][year] = Math.round(capVal * 10) / 10;
    }
  }

  return result;
}

/** Fetches physical industrial scale, electricity, and machinery trade turnover. */
async function fetchPhysicalAndMachineryData(forceUpdate = false): Promise<PhysicalData> {
  const logger = getLogger();
  if (!forceUpdate && (await fileExists(PHYSICAL_CACHE_FILE))) {
    try {
      const cached = await readJson<PhysicalData>(PHYSICAL_CACHE_FILE);
      if (cached.chapter84_nominal && cached.electricity_twh && cached.mva_trillions && Object.keys(cached.chapter84_nominal).length > 0) {
        logger.debug(`Loaded Physical data from cache: ${path.basename(PHYSICAL_CACHE_FILE)}`);
        return cached;
      }
    } catch {
      // ignore
    }
  }

  let existingData: Partial<PhysicalData> = {};
  if (await fileExists(PHYSICAL_CACHE_FILE)) {
    try {
      existingData = await readJson<PhysicalData>(PHYSICAL_CACHE_FILE);
    } catch {
      // ignore
    }
  }

  logger.debug('Fetching Physical Industrial & Machinery datasets (OWID, WB, UN Comtrade)...');

  const data: PhysicalData = {
    chapter84_nominal: Object.fromEntries(Object.keys(TARGET_MAP).map((c) => [c, {}])),
    electricity_twh: Object.fromEntries(Object.keys(TARGET_MAP).map((c) => [c, {}])),
    mva_trillions: Object.fromEntries(Object.keys(TARGET_MAP).map((c) => [c, {}])),
    solar_wind_twh: Object.fromEntries(Object.keys(TARGET_MAP).map((c) => [c, {}])),
    elec_per_capita_kwh: Object.fromEntries(Object.keys(TARGET_MAP).map((c) => [c, {}])),
  };

  // 1. OWID Energy Data
  logger.debug('Fetching OWID Energy (Electricity, Solar/Wind, Per-Capita)...');
  try {
    const owidUrl = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
    const res = await fetchWithRetry(owidUrl, { retries: 2, timeoutMs: 30000 });
    if (res.ok) {
      const csvText = await res.text();
      const parsed = parseOwidCsv(csvText, TARGET_MAP);
      data.electricity_twh = parsed.electricity_twh;
      data.solar_wind_twh = parsed.solar_wind_twh;
      data.elec_per_capita_kwh = parsed.elec_per_capita_kwh;
    }
  } catch (err) {
    logger.warn(`OWID energy fetch error (${err}). Falling back to cached energy data.`);
    if (existingData.electricity_twh) data.electricity_twh = existingData.electricity_twh;
    if (existingData.solar_wind_twh) data.solar_wind_twh = existingData.solar_wind_twh;
    if (existingData.elec_per_capita_kwh) data.elec_per_capita_kwh = existingData.elec_per_capita_kwh;
  }

  // 2. Manufacturing Value Added (WB WDI & IMF)
  logger.debug('Fetching World Bank Manufacturing Value Added (NV.IND.MANF.CD)...');
  try {
    const wbMap: Record<string, string> = { CHN: 'CHN', USA: 'USA', EUR: 'EUU', IND: 'IND', RUS: 'RUS', JPN: 'JPN', KOR: 'KOR' };
    const mvaUrl = `https://api.db.nomics.world/v22/series/WB/WDI?observations=1&dimensions=${encodeURIComponent(
      JSON.stringify({ indicator: ['NV.IND.MANF.CD'], country: Object.values(wbMap) }),
    )}&limit=1000`;

    const mvaRes = await fetchWithRetry(mvaUrl, { retries: 2, timeoutMs: 30000 });
    if (mvaRes.ok) {
      const mvaJson = (await mvaRes.json()) as {
        series?: {
          docs?: Array<{
            dimensions: { country: string };
            period?: string[];
            periods?: string[];
            value?: (number | null)[];
            values?: (number | null)[];
          }>;
        };
      };
      const invWb = Object.fromEntries(Object.entries(wbMap).map(([k, v]) => [v, k]));
      for (const doc of mvaJson.series?.docs || []) {
        const c = invWb[doc.dimensions.country];
        if (!c) continue;
        const periods = doc.period || doc.periods || [];
        const values = doc.value || doc.values || [];
        for (let i = 0; i < periods.length; i++) {
          const y = parseInt(periods[i], 10);
          const val = values[i];
          if (y >= START_YEAR && y <= END_YEAR && val != null && !Number.isNaN(val)) {
            data.mva_trillions[c][y] = Math.round((val / 1e12) * 1000) / 1000;
          }
        }
      }
    }

    // Taiwan MVA approximation (IMF GDP * 0.312)
    const twnMvaUrl = `https://api.db.nomics.world/v22/series/IMF/WEO:2024-10?observations=1&dimensions=${encodeURIComponent(
      JSON.stringify({ 'weo-country': ['TWN'], 'weo-subject': ['NGDPD'] }),
    )}&limit=100`;

    const twnMvaRes = await fetchWithRetry(twnMvaUrl, { retries: 2, timeoutMs: 20000 });
    if (twnMvaRes.ok) {
      const twnJson = (await twnMvaRes.json()) as {
        series?: {
          docs?: Array<{
            period?: string[];
            periods?: string[];
            value?: (number | null)[];
            values?: (number | null)[];
          }>;
        };
      };
      for (const doc of twnJson.series?.docs || []) {
        const periods = doc.period || doc.periods || [];
        const values = doc.value || doc.values || [];
        for (let i = 0; i < periods.length; i++) {
          const y = parseInt(periods[i], 10);
          const val = values[i];
          if (y >= START_YEAR && y <= END_YEAR && val != null) {
            data.mva_trillions.TWN[y] = Math.round(((val * 0.312) / 1e3) * 1000) / 1000;
          }
        }
      }
    }
  } catch (err) {
    logger.warn(`MVA fetch error (${err}). Falling back to cached MVA.`);
    if (existingData.mva_trillions) data.mva_trillions = existingData.mva_trillions;
  }

  // 3. UN Comtrade Chapter 84 Machinery Trade
  logger.debug('Fetching UN Comtrade Chapter 84 (All Machinery & Mechanical Appliances: 2000-2024)...');
  const repStr = Object.values(UN_COMTRADE_REPORTERS).join(',');
  const invRep = Object.fromEntries(Object.entries(UN_COMTRADE_REPORTERS).map(([k, v]) => [v, k]));
  const currentYear = new Date().getFullYear();
  const cachedCh84 = existingData.chapter84_nominal || {};
  const comtradeKey = process.env.COMTRADE_API_KEY || '';
  const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};

  for (let y = START_YEAR; y <= END_YEAR; y++) {
    // Preserve historical years if present in cache
    if (!forceUpdate && y < currentYear && y < END_YEAR && Object.keys(cachedCh84).length > 0) {
      const hasAllHist = Object.keys(TARGET_MAP).every((c) => cachedCh84[c]?.[y] != null || cachedCh84[c]?.[String(y)] != null);
      if (hasAllHist) {
        for (const c of Object.keys(TARGET_MAP)) {
          const val = cachedCh84[c][y] ?? cachedCh84[c][String(y)];
          if (val != null) {
            data.chapter84_nominal[c][y] = val;
          }
        }
        continue;
      }
    }

    try {
      const comtradeUrl = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?period=${y}&reporterCode=${repStr}&cmdCode=84&flowCode=M,X&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0`;
      const res = await fetchWithRetry(comtradeUrl, { retries: 3, timeoutMs: 45000, headers: comtradeHeaders });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ reporterCode: number; primaryValue: number }> };
        const sums: Record<string, number> = {};
        for (const row of json.data || []) {
          const c = invRep[row.reporterCode];
          if (c && row.primaryValue > 0) {
            sums[c] = (sums[c] || 0) + row.primaryValue;
          }
        }
        for (const [c, val] of Object.entries(sums)) {
          data.chapter84_nominal[c][y] = Math.round((val / 1e9) * 100) / 100;
        }
        logger.debug(`UN Comtrade Chapter 84 (${y}): fetched`);
      }
    } catch (e) {
      logger.warn(`UN Comtrade Chapter 84 (${y}): warning: ${e}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  await writeJson(PHYSICAL_CACHE_FILE, data, 0);
  logger.debug('Physical Industrial & Machinery data cached successfully.');
  return data;
}

/** Runs the World Economic ETL Pipeline. Deflates machinery trade by US CPI, formats time series across all 8 major powers, and exports the final dataset to site/src/data/world-economic.json. */
export async function runWorldEconomicPipeline(forceUpdate = false, verbose?: boolean): Promise<WorldEconomicDataset> {
  return runWithLogger(
    'world-economic',
    async () => {
      const logger = getLogger();
      logger.start('Starting World Economic ETL pipeline');

      await ensureDir(MACRO_CACHE_FILE);

      const macroRaw = await fetchMacroDataDbnomics(forceUpdate);
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
        gdpPppTrillions[c] = {};
        for (const [yStr, val] of Object.entries(series)) {
          const y = parseInt(yStr, 10);
          gdpPppTrillions[c][y] = val / 1e12;
        }
      }

      // Real Chapter 84 Machinery (Billion USD constant 2021)
      const ch84Real: Record<string, Record<number, number>> = {};
      for (const [c, series] of Object.entries(physicalData.chapter84_nominal || {})) {
        ch84Real[c] = {};
        for (const y of years) {
          const valNom = Number(series[y] ?? series[String(y)] ?? 0);
          if (valNom > 0) {
            ch84Real[c][y] = Math.round(valNom * usDeflator[y] * 10) / 10;
          }
        }
      }

      function formatMetric(rawDict: Record<string, Record<number | string, number | undefined>>, unitName: string, scale = 1.0, decimals = 2): WorldChartMetricData {
        const seriesByEntity: Record<string, (number | null)[]> = {};
        for (const c of Object.keys(ENTITIES)) {
          let cDict = rawDict[c];
          if (!cDict && c === 'EUU') cDict = rawDict.EUR;
          if (!cDict && c === 'EUR') cDict = rawDict.EUU;
          cDict = cDict || {};

          const values: (number | null)[] = [];
          for (const y of years) {
            const val = cDict[y] ?? cDict[String(y)];
            if (val != null && !Number.isNaN(val)) {
              const factor = 10 ** decimals;
              values.push(Math.round(val * scale * factor) / factor);
            } else {
              values.push(null);
            }
          }
          seriesByEntity[c] = values;
        }
        return { unit: unitName, series: seriesByEntity };
      }

      const dataset: WorldEconomicDataset = {
        years,
        entities: Object.fromEntries(Object.entries(ENTITIES).map(([k, v]) => [k, { name: v.name }])),
        charts: {
          gdp_ppp: formatMetric(gdpPppTrillions, 'Trillion Int$', 1.0, 2),
          gdp_per_capita_ppp: formatMetric(macroRaw.gdp_pcap_ppp_kd || {}, 'Int$ / person', 1.0, 0),
          machinery_turnover: formatMetric(ch84Real, 'Billion USD', 1.0, 1),
          electricity_generation: formatMetric(physicalData.electricity_twh || {}, 'TWh', 1.0, 1),
          manufacturing_value_added: formatMetric(physicalData.mva_trillions || {}, 'Trillion USD', 1.0, 2),
          clean_power: formatMetric(physicalData.solar_wind_twh || {}, 'TWh', 1.0, 1),
          electricity_per_capita: formatMetric(physicalData.elec_per_capita_kwh || {}, 'kWh / person', 1.0, 0),
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('world-economic');
      logger.success(`Exported world-economic dataset (${years.length} years, ${Object.keys(ENTITIES).length} entities)`);
      return dataset;
    },
    verbose,
  );
}

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWorldEconomicPipeline().catch((err) => {
    getLogger('world-economic').error('Fatal error running World Economic pipeline:', err);
    process.exit(1);
  });
}
