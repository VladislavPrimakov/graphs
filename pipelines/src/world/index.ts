import type {
  CleanPowerSectionData,
  ElectricityGenerationSectionData,
  ElectricityPerCapitaSectionData,
  GdpPerCapitaPppSectionData,
  GdpPppSectionData,
  ManufacturingPerCapitaSectionData,
  PassengerCarsSectionData,
  WorldToolbarMeta,
} from '@graphs/shared/types/world';
import countries from 'i18n-iso-countries';
import { ensurePipelineL1, fileExists, getRawDataPath, readJson, writeJsonAsyncToR2, writeJsonAsyncToSite } from '@/utils/fs';
import { fetchHeadMeta, fetchWithRetry, isRemoteMetaEqual, type RemoteFileMeta } from '@/utils/http';
import { getPipelineLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { range, round } from '@/utils/math';
import { updateMetadata } from '@/utils/metadata';
import { resolveRegionCode } from '@/utils/region';

const DATA_FILE = getRawDataPath('world');

const OWID_ENERGY_URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const WDI_SOURCE_URL = 'https://api.worldbank.org/v2/sources/2?format=json';
const ITF_TRANSPORT_URL = 'https://sdmx.oecd.org/public/rest/data/OECD.ITF,DSD_INDICATORS@DF_TRANSPORTINDICATORS/.A.VEHICLES...CARS..';
const UNECE_TRANSPORT_URL = 'https://w3.unece.org/PXWeb2015/api/v1/en/STAT/40-TRTRANS/03-TRRoadFleet/01_en_TRRoadTypVehR_r.px';

export const START_YEAR = 1990;
export const CURRENT_YEAR = new Date().getFullYear() - 1;
const DEFAULT_TOP = 7;
const MIN_TOP = 3;
const MAX_TOP = 15;

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
  aggregates: string[];
}

interface PhysicalData {
  electricity_twh: Record<string, Record<number | string, number>>;
  solar_wind_twh: Record<string, Record<number | string, number>>;
  elec_per_capita_kwh: Record<string, Record<number | string, number>>;
}

export interface WorldPipelineCache {
  meta?: {
    wdiLastUpdated?: string | null;
    owid?: RemoteFileMeta | null;
    itf?: RemoteFileMeta | null;
    uneceLastUpdated?: string | null;
  };
  macro: MacroData;
  manufacturing?: Record<string, Record<number, number>>;
  physical: PhysicalData;
  motorization?: Record<string, Record<number, number>>;
  sections: {
    'gdp-ppp': GdpPppSectionData;
    'gdp-per-capita-ppp': GdpPerCapitaPppSectionData;
    'manufacturing-per-capita': ManufacturingPerCapitaSectionData;
    'electricity-generation': ElectricityGenerationSectionData;
    'electricity-per-capita': ElectricityPerCapitaSectionData;
    'clean-power': CleanPowerSectionData;
    'passenger-cars': PassengerCarsSectionData;
  };
}

/** Exports flat datasets for world sections along with project-level toolbar metadata. */
async function exportWorld(sections: WorldPipelineCache['sections']): Promise<void> {
  const allEntities = new Set<string>();
  let minYear = Number.POSITIVE_INFINITY;
  let maxYear = Number.NEGATIVE_INFINITY;

  for (const sec of Object.values(sections)) {
    if (sec.years?.length) {
      minYear = Math.min(minYear, sec.years[0]);
      maxYear = Math.max(maxYear, sec.years[sec.years.length - 1]);
    }
    if (sec.series) {
      for (const entity of Object.keys(sec.series)) {
        allEntities.add(entity);
      }
    }
  }

  const gdpSection = sections['gdp-ppp'];
  const gdpMap: Record<string, number> = {};
  if (gdpSection?.series) {
    const numYears = gdpSection.years.length;
    for (const [entity, series] of Object.entries(gdpSection.series)) {
      for (let i = numYears - 1; i >= 0; i--) {
        const val = series[i];
        if (val != null && !Number.isNaN(val) && val > 0) {
          gdpMap[entity] = round(val * 1000, 1);
          break;
        }
      }
    }
  }

  const sortedEntities = Array.from(allEntities).sort((a, b) => {
    const diff = (gdpMap[b] ?? 0) - (gdpMap[a] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  const toolbarMeta: WorldToolbarMeta = {
    minYear: Number.isFinite(minYear) ? minYear : 1990,
    maxYear: Number.isFinite(maxYear) ? maxYear : CURRENT_YEAR,
    totalEntities: sortedEntities.length,
    entities: sortedEntities,
    gdp: gdpMap,
    defaultTop: DEFAULT_TOP,
    minTop: MIN_TOP,
    maxTop: MAX_TOP,
  };

  await writeJsonAsyncToSite('world/toolbar-meta.json', toolbarMeta);
  for (const [id, secData] of Object.entries(sections)) {
    await writeJsonAsyncToSite(`world/${id}.json`, secData);
  }
  await updateMetadata('world');
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

/** Fetches latest update timestamp for UNECE passenger road vehicle fleet table. */
async function fetchUneceLastUpdated(): Promise<string | null> {
  try {
    const res = await fetchWithRetry(UNECE_TRANSPORT_URL, { retries: 2, timeoutMs: 15000 });
    if (!res.ok) return null;
    const json = (await res.json()) as { updated?: string };
    return json.updated || null;
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
  const logger = getPipelineLogger('world');
  if (!forceUpdate && existingMacro?.gdp_ppp_kd && existingMacro?.gdp_pcap_ppp_kd) {
    logger.debug('Using cached World Bank & IMF macroeconomic data');
    return existingMacro;
  }

  logger.debug('Fetching global macroeconomic series from World Bank API & IMF WEO...');
  const data: MacroData = {
    gdp_ppp_kd: {},
    gdp_pcap_ppp_kd: {},
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
    const indicators: Array<{ code: string; key: 'gdp_ppp_kd' | 'gdp_pcap_ppp_kd' }> = [
      { code: 'NY.GDP.MKTP.PP.KD', key: 'gdp_ppp_kd' },
      { code: 'NY.GDP.PCAP.PP.KD', key: 'gdp_pcap_ppp_kd' },
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

        for (let y = START_YEAR; y <= CURRENT_YEAR; y++) {
          const perCapita = twnMap.NGDPRPPPPC?.[y];
          const lp = twnMap.LP?.[y];
          if (perCapita != null) {
            data.gdp_pcap_ppp_kd.TWN[y] = round(perCapita, 0);
            if (lp != null) {
              data.gdp_ppp_kd.TWN[y] = perCapita * lp * 1e6;
            }
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

/**
 * Fetches global manufacturing value added per capita from UN SDG 9.2.1 (UNIDO) API
 * and harmonizes European Union (EUU) from World Bank.
 * Rebased dynamically from constant 2020 USD to constant 2021 USD via World Bank US GDP deflator.
 */
async function fetchManufacturingData(existingMfg?: Record<string, Record<number, number>>, forceUpdate = false): Promise<Record<string, Record<number, number>>> {
  const logger = getPipelineLogger('world');
  if (!forceUpdate && existingMfg && Object.keys(existingMfg).length > 0) {
    logger.debug('Using cached UNIDO manufacturing per capita data');
    return existingMfg;
  }

  logger.debug('Fetching manufacturing per capita from UN SDG (UNIDO) & World Bank...');
  const mfgMap: Record<string, Record<number, number>> = {};

  try {
    const [unRes, deflRes, wbEuMfgRes, wbEuPopRes] = await Promise.all([
      fetchWithRetry('https://unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=NV_IND_MANFPC&pageSize=10000', { retries: 2, timeoutMs: 45000 }),
      fetchWithRetry('https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.DEFL.ZS?date=2015:2021&format=json', { retries: 2, timeoutMs: 30000 }),
      fetchWithRetry('https://api.worldbank.org/v2/country/EUU/indicator/NV.IND.MANF.KD?date=2000:2025&format=json', { retries: 2, timeoutMs: 30000 }),
      fetchWithRetry('https://api.worldbank.org/v2/country/EUU/indicator/SP.POP.TOTL?date=2000:2025&format=json', { retries: 2, timeoutMs: 30000 }),
    ]);

    // Parse US GDP deflator
    let deflator2020To2021 = 1.0456297;
    let deflator2015To2021 = 1.132248;
    if (deflRes.ok) {
      const [, deflRows] = (await deflRes.json()) as [unknown, Array<{ date?: string; value?: number | null }>];
      const defl: Record<number, number> = {};
      for (const row of deflRows || []) {
        const y = parseInt(row.date || '', 10);
        if (row.value != null && !Number.isNaN(row.value)) defl[y] = row.value;
      }
      if (defl[2020] && defl[2021]) deflator2020To2021 = defl[2021] / defl[2020];
      if (defl[2015] && defl[2021]) deflator2015To2021 = defl[2021] / defl[2015];
    }

    // Ingest UN SDG 9.2.1 across 210+ sovereign entities
    if (unRes.ok) {
      const unJson = (await unRes.json()) as { data?: Array<{ geoAreaCode?: string; timePeriodStart?: number; value?: string | null }> };
      for (const row of unJson.data || []) {
        const m49 = String(row.geoAreaCode || '');
        const alpha3 = countries.numericToAlpha3(m49) || (m49 === '158' ? 'TWN' : null);
        if (!alpha3 || EXCLUDED_ENTITIES.has(alpha3)) continue;
        const year = row.timePeriodStart;
        const val = row.value != null ? parseFloat(row.value) : null;
        if (year != null && year >= START_YEAR && year <= CURRENT_YEAR && val != null && !Number.isNaN(val)) {
          if (!mfgMap[alpha3]) mfgMap[alpha3] = {};
          mfgMap[alpha3][year] = round(val * deflator2020To2021, 0);
        }
      }
      logger.debug('UN SDG 9.2.1 series parsed');
    }

    // Ingest European Union (EUU) from World Bank
    if (wbEuMfgRes.ok && wbEuPopRes.ok) {
      const [, euMfgRows] = (await wbEuMfgRes.json()) as [unknown, Array<{ date?: string; value?: number | null }>];
      const [, euPopRows] = (await wbEuPopRes.json()) as [unknown, Array<{ date?: string; value?: number | null }>];
      const euPop: Record<number, number> = {};
      for (const r of euPopRows || []) {
        const y = parseInt(r.date || '', 10);
        if (r.value != null && !Number.isNaN(r.value)) euPop[y] = r.value;
      }
      mfgMap.EUU = {};
      for (const r of euMfgRows || []) {
        const y = parseInt(r.date || '', 10);
        const pop = euPop[y];
        if (pop && r.value != null && !Number.isNaN(r.value)) {
          mfgMap.EUU[y] = round((r.value / pop) * deflator2015To2021, 0);
        }
      }
      logger.debug('World Bank EUU manufacturing per capita parsed');
    }

    return mfgMap;
  } catch (err) {
    logger.warn(`Manufacturing data fetch error (${err}). Falling back to cached data.`);
    if (existingMfg && Object.keys(existingMfg).length > 0) return existingMfg;
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

    const solRaw = cols[solIdx]?.trim();
    const winRaw = cols[winIdx]?.trim();
    const solVal = solRaw ? parseFloat(solRaw) || 0 : 0;
    let winVal = winRaw ? parseFloat(winRaw) || 0 : 0;

    // OWID omitted EU27 wind data for 2000-2003; interpolate smoothly between 1999 (13.34 TWh) and 2004 (57.54 TWh)
    if (entityCode === 'EUU' && !winRaw) {
      const euWindMap: Record<number, number> = { 2000: 22.2, 2001: 31.0, 2002: 39.9, 2003: 48.7 };
      if (euWindMap[year]) winVal = euWindMap[year];
    }

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

/** Fetches physical industrial scale and electricity generation from OWID Energy. */
async function fetchPhysicalEnergyData(existingPhysical?: PhysicalData, owidChanged = true, forceUpdate = false): Promise<PhysicalData> {
  const logger = getPipelineLogger('world');
  const data: PhysicalData = {
    electricity_twh: existingPhysical?.electricity_twh || {},
    solar_wind_twh: existingPhysical?.solar_wind_twh || {},
    elec_per_capita_kwh: existingPhysical?.elec_per_capita_kwh || {},
  };

  if (owidChanged || forceUpdate || !existingPhysical?.electricity_twh) {
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

  return data;
}

const UNECE_NUMERIC_TO_ALPHA3: Record<string, string> = {
  '840': 'USA',
  '124': 'CAN',
  '643': 'RUS',
  '804': 'UKR',
  '826': 'GBR',
  '276': 'DEU',
  '250': 'FRA',
  '380': 'ITA',
  '724': 'ESP',
  '616': 'POL',
  '528': 'NLD',
  '056': 'BEL',
  '756': 'CHE',
  '040': 'AUT',
  '752': 'SWE',
  '578': 'NOR',
  '208': 'DNK',
  '246': 'FIN',
  '300': 'GRC',
  '620': 'PRT',
  '372': 'IRL',
  '203': 'CZE',
  '348': 'HUN',
  '642': 'ROU',
  '100': 'BGR',
  '703': 'SVK',
  '191': 'HRV',
  '705': 'SVN',
  '440': 'LTU',
  '428': 'LVA',
  '233': 'EST',
  '196': 'CYP',
  '470': 'MLT',
  '442': 'LUX',
  '352': 'ISL',
  '792': 'TUR',
  '376': 'ISR',
  '112': 'BLR',
  '398': 'KAZ',
  '860': 'UZB',
  '031': 'AZE',
  '268': 'GEO',
  '051': 'ARM',
  '417': 'KGZ',
  '762': 'TJK',
  '795': 'TKM',
  '498': 'MDA',
  '688': 'SRB',
  '070': 'BIH',
  '499': 'MNE',
  '807': 'MKD',
  '008': 'ALB',
};

/**
 * Official US Bureau of Transportation Statistics (BTS Table 1-11) Light Duty Vehicles
 * (Passenger cars + SUVs + personal light trucks) per 1,000 inhabitants.
 * Replaces the 2006-2018 UNECE reporting artifact where FHWA temporarily excluded personal light trucks/SUVs.
 */
const US_BTS_HARMONIZED: Record<number, number> = {
  2006: 786,
  2007: 788,
  2008: 784,
  2009: 766,
  2010: 745,
  2011: 737,
  2012: 744,
  2013: 752,
  2014: 762,
  2015: 778,
  2016: 791,
  2017: 802,
  2018: 812,
};

/**
 * Official Statistics Canada (CANSIM / Table 23-10-0067) Light-Duty Vehicles (under 4.5 tonnes)
 * per 1,000 inhabitants. Harmonizes pre-2009 reporting (when only sedans were reported)
 * and post-2018 OECD ITF fallback to maintain a consistent North American passenger vehicle standard.
 */
const CAN_HARMONIZED: Record<number, number> = {
  1993: 495,
  1994: 502,
  1995: 510,
  1996: 515,
  1997: 522,
  1998: 530,
  1999: 538,
  2000: 545,
  2001: 552,
  2002: 558,
  2003: 565,
  2004: 570,
  2005: 576,
  2006: 580,
  2007: 584,
  2008: 588,
  2009: 592,
  2010: 597,
  2011: 596.5,
  2012: 596,
  2013: 607,
  2014: 614,
  2015: 619,
  2016: 622,
  2017: 621,
  2018: 625,
  2019: 625,
  2020: 625,
  2021: 630,
  2022: 621,
  2023: 589,
  2024: 595,
};

/** Harmonizes statistical artifacts for US BTS Light Duty Vehicles and Statistics Canada Light-Duty Vehicles. */
function applyMotorizationHarmonization(combined: Record<string, Record<number, number>>): Record<string, Record<number, number>> {
  if (combined.USA) {
    for (const [yStr, val] of Object.entries(US_BTS_HARMONIZED)) {
      combined.USA[parseInt(yStr, 10)] = val;
    }
  }
  if (combined.CAN) {
    for (const [yStr, val] of Object.entries(CAN_HARMONIZED)) {
      combined.CAN[parseInt(yStr, 10)] = val;
    }
  }
  return combined;
}

/** Fetches global motorization rates (passenger cars per 1,000 inhabitants) from OECD ITF & UNECE. */
async function fetchMotorizationData(existingMotorization?: Record<string, Record<number, number>>, forceUpdate = false): Promise<Record<string, Record<number, number>>> {
  const logger = getPipelineLogger('world');
  if (!forceUpdate && existingMotorization) {
    logger.debug('Using cached OECD ITF & UNECE motorization data');
    return applyMotorizationHarmonization(existingMotorization);
  }

  logger.debug('Fetching motorization indicators from OECD ITF & UNECE...');
  const combined: Record<string, Record<number, number>> = {};

  // 1. Fetch OECD International Transport Forum (ITF) SDMX
  try {
    const itfRes = await fetchWithRetry(ITF_TRANSPORT_URL, {
      retries: 2,
      timeoutMs: 30000,
      headers: { Accept: 'application/vnd.sdmx.data+json' },
    });
    if (itfRes.ok) {
      const itfJson = (await itfRes.json()) as {
        data: {
          structures?: Array<{
            dimensions: {
              series: Array<{ id: string; values: Array<{ id: string }> }>;
              observation: Array<{ id: string; values: Array<{ id: string }> }>;
            };
          }>;
          structure?: {
            dimensions: {
              series: Array<{ id: string; values: Array<{ id: string }> }>;
              observation: Array<{ id: string; values: Array<{ id: string }> }>;
            };
          };
          dataSets: Array<{ series?: Record<string, { observations?: Record<string, [number]> }> }>;
        };
      };

      const struct = itfJson.data.structures ? itfJson.data.structures[0] : itfJson.data.structure;
      if (struct) {
        const itfAreas = struct.dimensions.series.find((d) => d.id === 'REF_AREA')?.values || [];
        const itfUnits = struct.dimensions.series.find((d) => d.id === 'UNIT_MEASURE')?.values || [];
        const itfTimeObs = struct.dimensions.observation.find((d) => d.id === 'TIME_PERIOD')?.values || [];
        const itfSeries = itfJson.data.dataSets?.[0]?.series || {};
        const unitHabIdx = itfUnits.findIndex((u) => u.id === '10P3HB');

        for (const [k, v] of Object.entries(itfSeries)) {
          const parts = k.split(':');
          const areaIdx = parseInt(parts[0], 10);
          const unitIdx = parseInt(parts[3], 10);
          if (unitIdx !== unitHabIdx) continue;
          const code = itfAreas[areaIdx]?.id;
          if (!code || EXCLUDED_ENTITIES.has(code)) continue;

          combined[code] = combined[code] || {};
          const obs = v.observations || {};
          for (const [tIdx, valArr] of Object.entries(obs)) {
            const yearStr = itfTimeObs[parseInt(tIdx, 10)]?.id;
            const year = parseInt(yearStr || '', 10);
            const val = valArr?.[0];
            if (year >= START_YEAR && year <= CURRENT_YEAR && val != null && !Number.isNaN(val) && val > 0) {
              combined[code][year] = round(val, 1);
            }
          }
        }
        logger.debug(`OECD ITF motorization parsed (${Object.keys(combined).length} countries)`);
      }
    }
  } catch (err) {
    logger.warn('Failed to fetch OECD ITF motorization data:', err);
  }

  // 2. Fetch UNECE Sustainable Transport Division PXWeb JSON-stat
  try {
    const uneceBody = {
      query: [
        { code: 'Measurement', selection: { filter: 'item', values: ['TR.123'] } },
        { code: 'Vehicle category', selection: { filter: 'item', values: ['TR.396'] } },
      ],
      response: { format: 'json-stat2' },
    };
    const uneceRes = await fetchWithRetry(UNECE_TRANSPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uneceBody),
      retries: 2,
      timeoutMs: 30000,
    });
    if (uneceRes.ok) {
      const uneceJson = (await uneceRes.json()) as {
        dimension: {
          Country: { category: { index: Record<string, number> } };
          Year: { category: { label: Record<string, string> } };
        };
        value: Array<number | null>;
      };

      const uneceCountries = uneceJson.dimension.Country.category.index;
      const uneceYears = uneceJson.dimension.Year.category.label;
      const numYears = Object.keys(uneceYears).length;
      const uneceValues = uneceJson.value;

      for (const [cNum, cIdx] of Object.entries(uneceCountries)) {
        const alpha3 = UNECE_NUMERIC_TO_ALPHA3[cNum];
        if (!alpha3 || EXCLUDED_ENTITIES.has(alpha3)) continue;
        combined[alpha3] = combined[alpha3] || {};
        const baseOffset = cIdx * numYears;
        for (let yI = 0; yI < numYears; yI++) {
          const year = parseInt(uneceYears[String(yI)], 10);
          const val = uneceValues[baseOffset + yI];
          if (year >= START_YEAR && year <= CURRENT_YEAR && val != null && !Number.isNaN(val) && val > 0) {
            if (!combined[alpha3][year]) {
              combined[alpha3][year] = round(val, 1);
            }
          }
        }
      }
      logger.debug(`UNECE motorization merged (total ${Object.keys(combined).length} countries)`);
    }
  } catch (err) {
    logger.warn('Failed to fetch UNECE motorization data:', err);
  }

  return applyMotorizationHarmonization(combined);
}

/** Resolves the latest available non-null value in a time series looking backwards. */
function getLatestVal(dict: Record<number | string, number | undefined>, endYear: number): number {
  for (let y = endYear; y >= START_YEAR; y--) {
    const v = dict[y] ?? dict[String(y)];
    if (v != null && !Number.isNaN(v)) return v;
  }
  return 0;
}

/** Runs the World ETL Pipeline. Deflates machinery and MVA by US CPI, computes rankings, and exports section datasets. */
export async function runWorldPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'world',
    async () => {
      const logger = getPipelineLogger('world');
      logger.start('World');

      await ensurePipelineL1('world');

      const force = forceUpdate || isUpdate();
      let cache = await loadWorldCache();
      if (force) {
        logger.info('Force update requested (-u): resetting data.json cache...');
        cache = null;
      }

      const hasValidDataset =
        Boolean(cache?.sections?.['gdp-ppp']?.years?.length) &&
        cache?.sections?.['gdp-ppp']?.years?.[0] === START_YEAR &&
        (cache?.sections?.['gdp-ppp']?.years?.[cache.sections['gdp-ppp'].years.length - 1] ?? 0) === CURRENT_YEAR &&
        Boolean(cache?.sections?.['manufacturing-per-capita']) &&
        Boolean(cache?.manufacturing) &&
        Boolean(cache?.sections?.['passenger-cars']);

      let remoteWdiDate: string | null = null;
      let remoteOwidMeta: RemoteFileMeta | null = null;
      let remoteItfMeta: RemoteFileMeta | null = null;
      let remoteUneceDate: string | null = null;
      let wdiChanged = true;
      let owidChanged = true;
      let motorizationChanged = true;

      // Fast check: verify if remote files/databases are unchanged via HTTP metadata
      if (!force && hasValidDataset && cache?.meta) {
        logger.debug('Checking World Bank, OWID, ITF and UNECE metadata...');
        [remoteWdiDate, remoteOwidMeta, remoteItfMeta, remoteUneceDate] = await Promise.all([
          fetchWdiLastUpdated(),
          fetchHeadMeta(OWID_ENERGY_URL),
          fetchHeadMeta(ITF_TRANSPORT_URL),
          fetchUneceLastUpdated(),
        ]);

        const networkFailed = remoteWdiDate === null && remoteOwidMeta === null && remoteItfMeta === null;
        if (networkFailed) {
          logger.warn('Remote data sources unreachable (offline). Using cached dataset.');
          await exportWorld(cache.sections);
          return;
        }

        wdiChanged = remoteWdiDate == null || remoteWdiDate !== cache.meta.wdiLastUpdated;
        owidChanged = !isRemoteMetaEqual(cache.meta.owid, remoteOwidMeta);
        motorizationChanged = !isRemoteMetaEqual(cache.meta.itf, remoteItfMeta) || (remoteUneceDate != null && remoteUneceDate !== cache.meta.uneceLastUpdated);

        const isUpToDate = !wdiChanged && !owidChanged && !motorizationChanged;

        if (isUpToDate) {
          logger.unchanged('WDI, OWID, ITF & UNECE match');
          await exportWorld(cache.sections);
          return;
        }

        logger.detected('Refreshing dataset');
      }

      const macroRaw = await fetchMacroDataWorldBank(cache?.macro, force || wdiChanged);
      const mfgData = await fetchManufacturingData(cache?.manufacturing, force || wdiChanged);
      const physicalData = await fetchPhysicalEnergyData(cache?.physical, owidChanged, force);
      const motorizationData = await fetchMotorizationData(cache?.motorization, force || motorizationChanged);

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
      for (const series of Object.values(motorizationData || {})) {
        for (const yStr of Object.keys(series)) {
          const y = parseInt(yStr, 10);
          if (y > maxYear && y <= CURRENT_YEAR) maxYear = y;
        }
      }
      const endYear = maxYear;
      const years = range(START_YEAR, endYear);

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

      const aggregateSet = new Set(macroRaw.aggregates || []);
      const nonEuAggregates = new Set([...aggregateSet].filter((c) => c !== 'EUU'));

      function isCountry(code: string): boolean {
        if (code === 'EUU' || code === 'EU') return false;
        if (nonEuAggregates.has(code) || EXCLUDED_ENTITIES.has(code)) return false;
        return true;
      }

      function formatMetric(
        rawDict: Record<string, Record<number | string, number | undefined>>,
        scale = 1.0,
        decimals = 2,
      ): {
        series: Record<string, (number | null)[]>;
        growth: Record<string, (number | null)[]>;
      } {
        const entityLatest = new Map<string, number>();
        for (const [code, series] of Object.entries(rawDict)) {
          if (!isCountry(code) && code !== 'EUU') continue;
          const lv = getLatestVal(series, endYear);
          if (lv > 0) {
            entityLatest.set(code, lv);
          }
        }

        const sortedEntities = Array.from(entityLatest.keys()).sort((a, b) => (entityLatest.get(b) || 0) - (entityLatest.get(a) || 0));

        const seriesByEntity: Record<string, (number | null)[]> = {};
        const growthByEntity: Record<string, (number | null)[]> = {};

        for (const c of sortedEntities) {
          const cDict = rawDict[c];
          if (!cDict) continue;
          const values: (number | null)[] = [];
          const growth: (number | null)[] = [];
          let hasAny = false;

          for (let i = 0; i < years.length; i++) {
            const y = years[i];
            const val = cDict[y] ?? cDict[String(y)];
            if (val != null && !Number.isNaN(val)) {
              hasAny = true;
              const roundedVal = round(val * scale, decimals);
              values.push(roundedVal);

              const prevY = y - 1;
              const prevValRaw = i === 0 ? (cDict[prevY] ?? cDict[String(prevY)]) : values[i - 1];
              if (prevValRaw != null && prevValRaw > 0) {
                const scaledPrev = i === 0 ? prevValRaw * scale : prevValRaw;
                growth.push(round(((roundedVal - scaledPrev) / scaledPrev) * 100, 1));
              } else {
                growth.push(null);
              }
            } else {
              values.push(null);
              growth.push(null);
            }
          }

          if (hasAny) {
            const regionCode = resolveRegionCode(c);
            if (!seriesByEntity[regionCode]) {
              seriesByEntity[regionCode] = values;
              growthByEntity[regionCode] = growth;
            }
          }
        }

        return {
          series: seriesByEntity,
          growth: growthByEntity,
        };
      }

      const gdpPppFormatted = formatMetric(gdpPppTrillions, 1.0, 2);
      const gdpPerCapFormatted = formatMetric(macroRaw.gdp_pcap_ppp_kd || {}, 1.0, 0);
      const mfgPerCapFormatted = formatMetric(mfgData || {}, 1.0, 0);
      const elecGenFormatted = formatMetric(physicalData.electricity_twh || {}, 1.0, 1);
      const cleanPowerFormatted = formatMetric(physicalData.solar_wind_twh || {}, 1.0, 1);
      const elecPerCapFormatted = formatMetric(physicalData.elec_per_capita_kwh || {}, 1.0, 0);
      const carsFormatted = formatMetric(motorizationData || {}, 1.0, 1);

      const sections = {
        'gdp-ppp': { years, series: gdpPppFormatted.series, growth: gdpPppFormatted.growth },
        'gdp-per-capita-ppp': { years, series: gdpPerCapFormatted.series, growth: gdpPerCapFormatted.growth },
        'manufacturing-per-capita': { years, series: mfgPerCapFormatted.series, growth: mfgPerCapFormatted.growth },
        'electricity-generation': { years, series: elecGenFormatted.series, growth: elecGenFormatted.growth },
        'clean-power': { years, series: cleanPowerFormatted.series, growth: cleanPowerFormatted.growth },
        'electricity-per-capita': { years, series: elecPerCapFormatted.series, growth: elecPerCapFormatted.growth },
        'passenger-cars': { years, series: carsFormatted.series, growth: carsFormatted.growth },
      };

      await writeJsonAsyncToR2(DATA_FILE, {
        meta: {
          wdiLastUpdated: remoteWdiDate || cache?.meta?.wdiLastUpdated || null,
          owid: remoteOwidMeta || cache?.meta?.owid || null,
          itf: remoteItfMeta || cache?.meta?.itf || null,
          uneceLastUpdated: remoteUneceDate || cache?.meta?.uneceLastUpdated || null,
        },
        macro: macroRaw,
        manufacturing: mfgData,
        physical: physicalData,
        motorization: motorizationData,
        sections,
      });
      await exportWorld(sections);
      logger.complete(`${years[0]}–${years[years.length - 1]} global metrics across all sovereign economies`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runWorldPipeline(isUpdate(), isVerbose()).catch((err) => {
    getPipelineLogger('world').error('Fatal error running World pipeline:', err);
    process.exit(1);
  });
}
