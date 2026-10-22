import type { CountryToolbarMeta } from '@graphs/shared/types/country';
import { type CountryMacroYear, type CountryPartnerTradeRecord, type CountryProfileData, type CountryYearRecord, TRADE_CATEGORY_IDS, type TradeCategoryId } from '@graphs/shared/types/country';
import { exportProjectMeta, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, flushPendingJsonSaves, readJson, writeJsonAsync } from '@/utils/fs';
import { fetchWithRetry, HttpError } from '@/utils/http';
import { getPipelineLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { range, round } from '@/utils/math';
import { updateMetadata } from '@/utils/metadata';
import { loadEnv } from '@/utils/paths';
import { resolveRegionCode } from '@/utils/region';
import { COUNTRY_CATEGORIES_META, EBOPS_NORMALIZATION_MAP, EBOPS_TO_SERVICES_MAP, HS_TO_MACRO_MAP, HS2_CHAPTERS } from './classification';
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_BY_ID, COUNTRY_BY_ISO3, type CountryEntry, SUPPORTED_COUNTRIES } from './countries';

loadEnv();

const DATA_FILE = getPipelineDataPath('country');

export { COUNTRIES, SUPPORTED_COUNTRIES };

export const START_YEAR = 1990;
export const CURRENT_YEAR = new Date().getFullYear() - 1;
export const CHUNK_SIZE_GOODS = 4;
export const CHUNK_SIZE_SERVICES = 12;
export const CHUNK_SIZE = 12;

const comtradeKey = process.env.COMTRADE_API_KEY || '';
const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};

/** UN Comtrade statistical, accounting, and unspecified non-country area aggregates mapped to Others. */
export const STATISTICAL_PARTNER_CODES = new Set(['_X', 'XX', 'X1', 'X2', 'E19', 'F19', 'O19', 'A79', 'A59', 'F97', 'E29', 'A49', 'F49', 'R91', 'NTZ', '_AC', '_CI', '_SM', '_TK', '_WI', '_ZP']);

export interface RawYearData {
  /** Raw merchandise goods exports by 2-digit HS chapter in billion USD: { "01": 1.25, ... } or null if no trade reported */
  goodsExports?: Record<string, number> | null;
  /** Raw commercial services exports by 3-digit EBOPS code in billion USD: { "205": 91.0, ... } or null if no trade reported */
  servicesExports?: Record<string, number> | null;
  /** Raw commercial services imports by 3-digit EBOPS code in billion USD: { "205": 45.2, ... } or null if no trade reported */
  servicesImports?: Record<string, number> | null;
  /** Bilateral merchandise goods exports by active partner code and 2-digit HS chapter: { "cn": { "84": 13.9, ... }, ... } or null if no trade reported */
  partnerGoodsExports?: Record<string, Record<string, number>> | null;
  /** Upstream UN Comtrade HS goods dataset checksum for this reporter and year */
  goodsChecksum?: number | null;
  /** Upstream UN Comtrade EBOPS services dataset checksum for this reporter and year */
  servicesChecksum?: number | null;

  // Macroeconomic indicators from IMF World Economic Outlook (short codes matching API):
  /** Nominal GDP in billion USD (IMF: NGDPD) */
  ngdpd?: number | null;
  /** Real GDP growth YoY percentage (IMF: NGDP_RPCH) */
  rpch?: number | null;
  /** Nominal GDP per capita in USD (IMF: NGDPDPC) */
  dpc?: number | null;
  /** GDP at purchasing power parity in billion current international dollars (IMF: PPPGDP) */
  pppgdp?: number | null;
  /** General government total expenditure as % of GDP (IMF: G_X_G01_GDP_PT) */
  gx?: number | null;
  /** General government total revenue as % of GDP (IMF: GGR_G01_GDP_PT) */
  ggr?: number | null;
  /** General government net lending/borrowing balance as % of GDP (IMF: GGXCNL_NGDP) */
  ggxcnl?: number | null;
  /** General government gross debt as % of GDP (IMF: GGXWDG_NGDP) */
  ggxwdg?: number | null;
  /** Consumer price index inflation rate YoY % (IMF: PCPIPCH) */
  pcpipch?: number | null;
  /** Unemployment rate as % of labor force (IMF: LUR) */
  lur?: number | null;
  /** Current account balance as % of GDP (IMF: BCA_NGDPD) */
  bca?: number | null;
}

export interface RawCountryProfile {
  code: string;
  years: Record<string, RawYearData>;
}

export interface CountryPipelineCacheMeta {
  imfLastModified?: string;
  lastUpdated?: string;
}

export interface CountryPipelineCache {
  meta?: CountryPipelineCacheMeta;
  countries: Record<string, RawCountryProfile>;
}

export interface AvailabilityCatalog {
  goodsChecksums: Map<string, number>;
  servicesChecksums: Map<string, number>;
  imfLastModified?: string;
}

let comtradeQuotaExhausted = false;

/** Returns true if UN Comtrade API call volume quota has been exceeded for the day. */
export function isComtradeQuotaExhausted(): boolean {
  return comtradeQuotaExhausted;
}

/** Minimum interval between UN Comtrade requests to adhere strictly to Azure API Management 1 req/sec rate limit. */
export const COMTRADE_PACER_DELAY_MS = 1000;

// Centralized UN Comtrade serialized queue ensuring exactly 1 in-flight request at all times
let comtradeQueue = Promise.resolve();

async function fetchComtradeWithPacer(url: string): Promise<Response> {
  if (comtradeQuotaExhausted) {
    throw new HttpError(403, url, 'Out of call volume quota (circuit breaker active)');
  }
  const run = async () => {
    if (comtradeQuotaExhausted) {
      throw new HttpError(403, url, 'Out of call volume quota (circuit breaker active)');
    }
    try {
      return await fetchWithRetry(url, { retries: 2, backoffMs: 2000, timeoutMs: 300000, headers: comtradeHeaders });
    } catch (err) {
      if (err instanceof HttpError && err.isQuotaExhausted) {
        if (!comtradeQuotaExhausted) {
          comtradeQuotaExhausted = true;
          getPipelineLogger('country').warn(`UN Comtrade quota exhausted: ${err.message}`);
        }
      }
      throw err;
    }
  };
  const resultPromise = comtradeQueue.then(run, run);
  comtradeQueue = resultPromise.then(
    () => new Promise((resolve) => setTimeout(resolve, COMTRADE_PACER_DELAY_MS)),
    () => new Promise((resolve) => setTimeout(resolve, COMTRADE_PACER_DELAY_MS)),
  );
  return resultPromise;
}

/** Chunks an array into smaller groups of given size. */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Chunks an array of years into groups up to max chunk size (default 12 for UN Comtrade). */
export function chunkYears(years: number[], chunkSize = CHUNK_SIZE): number[][] {
  return chunkArray(years, chunkSize);
}

/** Identifies which years and data streams are missing from an existing raw country profile. */
export function detectMissingStreams(
  existing: RawCountryProfile | undefined,
  targetYears: number[],
  reporterId?: number,
  catalog?: AvailabilityCatalog,
  cachedImfLastModified?: string,
): { goods: number[]; partners: number[]; services: number[]; needsImf: boolean } {
  const missingGoods: number[] = [];
  const missingServices: number[] = [];

  const hasGoodsCatalog = Boolean(reporterId && catalog && catalog.goodsChecksums.size > 0);
  const hasServicesCatalog = Boolean(reporterId && catalog && catalog.servicesChecksums.size > 0);

  for (const y of targetYears) {
    const yStr = String(y);
    const yData = existing?.years?.[yStr];

    const upstreamGoodsChecksum = reporterId && catalog ? catalog.goodsChecksums.get(`${reporterId}:${y}`) : undefined;
    const upstreamServicesChecksum = reporterId && catalog ? catalog.servicesChecksums.get(`${reporterId}:${y}`) : undefined;

    const hasGoodsInCache = yData?.goodsExports !== undefined && yData?.partnerGoodsExports !== undefined;
    const hasServicesInCache = yData?.servicesExports !== undefined && yData?.servicesImports !== undefined;

    let needsGoodsFetch = false;
    if (hasGoodsCatalog) {
      if (upstreamGoodsChecksum !== undefined) {
        needsGoodsFetch = !hasGoodsInCache || yData?.goodsChecksum !== upstreamGoodsChecksum;
      }
    } else {
      needsGoodsFetch = !hasGoodsInCache;
    }

    let needsServicesFetch = false;
    if (hasServicesCatalog) {
      if (upstreamServicesChecksum !== undefined) {
        needsServicesFetch = !hasServicesInCache || yData?.servicesChecksum !== upstreamServicesChecksum;
      }
    } else {
      needsServicesFetch = !hasServicesInCache;
    }

    if (needsGoodsFetch) missingGoods.push(y);
    if (needsServicesFetch) missingServices.push(y);
  }

  const imfChanged = Boolean(catalog?.imfLastModified && cachedImfLastModified !== catalog.imfLastModified);
  const hasAnyGdp = Object.values(existing?.years || {}).some((y) => y.ngdpd !== undefined && y.ngdpd !== null);
  const needsImf = !hasAnyGdp || imfChanged;

  return {
    goods: missingGoods,
    partners: missingGoods,
    services: missingServices,
    needsImf,
  };
}

/** Returns true if a country profile is fully populated across all target years and all streams. */
export function isCountryComplete(
  existing: RawCountryProfile | undefined,
  targetYears: number[] = range(START_YEAR, CURRENT_YEAR),
  reporterId?: number,
  catalog?: AvailabilityCatalog,
  cachedImfLastModified?: string,
): boolean {
  if (!existing) return false;
  const missing = detectMissingStreams(existing, targetYears, reporterId, catalog, cachedImfLastModified);
  return missing.goods.length === 0 && missing.services.length === 0 && !missing.needsImf;
}

let partnerAreasCache: Record<number, string> | null = null;

/** Returns in-memory mapping of numeric UN partner codes to ISO-3 codes for non-sovereign overseas territories. */
export async function getPartnerAreasMap(): Promise<Record<number, string>> {
  if (partnerAreasCache) return partnerAreasCache;
  const partners: Record<number, string> = {};
  try {
    const res = await fetchWithRetry('https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json', { retries: 2, timeoutMs: 20000 });
    if (res.ok) {
      const json = (await res.json()) as { results?: Array<{ id?: number; PartnerCodeIsoAlpha3?: string }> };
      for (const p of json.results || []) {
        if (p.id && p.PartnerCodeIsoAlpha3 && p.PartnerCodeIsoAlpha3.length === 3) {
          partners[p.id] = p.PartnerCodeIsoAlpha3;
        }
      }
    }
  } catch (err) {
    getPipelineLogger('country').warn(`Failed to fetch partnerAreas.json: ${err}`);
  }
  partnerAreasCache = partners;
  return partners;
}

interface ImfIndicators {
  NGDPD?: Record<string, number>;
  NGDP_RPCH?: Record<string, number>;
  NGDPDPC?: Record<string, number>;
  PPPGDP?: Record<string, number>;
  G_X_G01_GDP_PT?: Record<string, number>;
  GGR_G01_GDP_PT?: Record<string, number>;
  GGXCNL_NGDP?: Record<string, number>;
  GGXWDG_NGDP?: Record<string, number>;
  PCPIPCH?: Record<string, number>;
  LUR?: Record<string, number>;
  BCA_NGDPD?: Record<string, number>;
}

/** Fetches full macroeconomic indicator maps for a country from IMF DataMapper in a single call. */
async function fetchImfIndicators(iso3: string): Promise<ImfIndicators> {
  const logger = getPipelineLogger('country');
  try {
    const imfUrl = `https://www.imf.org/external/datamapper/api/v1/NGDPD/NGDP_RPCH/NGDPDPC/PPPGDP/G_X_G01_GDP_PT/GGR_G01_GDP_PT/GGXCNL_NGDP/GGXWDG_NGDP/PCPIPCH/LUR/BCA_NGDPD/${iso3}`;
    const imfRes = await fetchWithRetry(imfUrl, { retries: 2, timeoutMs: 25000 });
    if (imfRes.ok) {
      const imfJson = (await imfRes.json()) as { values?: Record<string, Record<string, Record<string, number>>> };
      const vals = imfJson.values || {};
      return {
        NGDPD: vals.NGDPD?.[iso3],
        NGDP_RPCH: vals.NGDP_RPCH?.[iso3],
        NGDPDPC: vals.NGDPDPC?.[iso3],
        PPPGDP: vals.PPPGDP?.[iso3],
        G_X_G01_GDP_PT: vals.G_X_G01_GDP_PT?.[iso3],
        GGR_G01_GDP_PT: vals.GGR_G01_GDP_PT?.[iso3],
        GGXCNL_NGDP: vals.GGXCNL_NGDP?.[iso3],
        GGXWDG_NGDP: vals.GGXWDG_NGDP?.[iso3],
        PCPIPCH: vals.PCPIPCH?.[iso3],
        LUR: vals.LUR?.[iso3],
        BCA_NGDPD: vals.BCA_NGDPD?.[iso3],
      };
    }
  } catch (err) {
    logger.warn(`Failed to fetch IMF for ${iso3}: ${err}`);
  }
  return {};
}

let availabilityCatalogCache: AvailabilityCatalog | null = null;

/** Fetches full availability catalogs from UN Comtrade and latest WEO release from IMF DataMapper in 3 calls. */
export async function fetchAvailabilityCatalog(): Promise<AvailabilityCatalog> {
  if (availabilityCatalogCache) return availabilityCatalogCache;
  const logger = getPipelineLogger('country');
  const goodsChecksums = new Map<string, number>();
  const servicesChecksums = new Map<string, number>();
  let imfLastModified: string | undefined;

  try {
    const goodsRes = await fetchComtradeWithPacer('https://comtradeapi.un.org/data/v1/getDa/C/A/HS');
    if (goodsRes.ok) {
      const json = (await goodsRes.json()) as { data?: Array<{ reporterCode: number; period: number; datasetChecksum: number }> };
      for (const row of json.data || []) {
        if (row.datasetChecksum !== undefined && row.datasetChecksum !== null) {
          goodsChecksums.set(`${row.reporterCode}:${row.period}`, row.datasetChecksum);
        }
      }
    }
  } catch (err) {
    logger.warn(`Failed to fetch goods availability catalog: ${err}`);
  }

  try {
    const servRes = await fetchComtradeWithPacer('https://comtradeapi.un.org/data/v1/getDa/S/A/EB');
    if (servRes.ok) {
      const json = (await servRes.json()) as { data?: Array<{ reporterCode: number; period: number; datasetChecksum: number }> };
      for (const row of json.data || []) {
        if (row.datasetChecksum !== undefined && row.datasetChecksum !== null) {
          servicesChecksums.set(`${row.reporterCode}:${row.period}`, row.datasetChecksum);
        }
      }
    }
  } catch (err) {
    logger.warn(`Failed to fetch services availability catalog: ${err}`);
  }

  try {
    const imfRes = await fetchWithRetry('https://www.imf.org/external/datamapper/api/v1/indicators', { retries: 2, timeoutMs: 15000 });
    if (imfRes.ok) {
      const json = (await imfRes.json()) as { indicators?: Record<string, { 'last-modified'?: string }> };
      imfLastModified = json.indicators?.NGDPD?.['last-modified'] || json.indicators?.NGDP_RPCH?.['last-modified'];
    }
  } catch (err) {
    logger.warn(`Failed to fetch IMF indicators metadata: ${err}`);
  }

  availabilityCatalogCache = { goodsChecksums, servicesChecksums, imfLastModified };
  return availabilityCatalogCache;
}

export interface UnifiedAg2Row {
  reporterCode: number;
  partnerCode: number;
  period: string;
  flowCode: string;
  cmdCode: string;
  primaryValue: number;
}

export interface IngestedAg2Data {
  goodsExports: Record<string, number>;
  partnerGoodsExports: Record<string, Record<string, number>>;
}

/**
 * Ingests unified UN Comtrade flowCode=X rows containing both world totals (partnerCode=0)
 * and individual sovereign partner countries.
 */
export function ingestUnifiedAg2Rows(rows: UnifiedAg2Row[], targetReporterId: number, partnerCodeResolver?: (id: number) => string | undefined): Record<string, IngestedAg2Data> {
  const result: Record<string, IngestedAg2Data> = {};

  for (const r of rows) {
    if (r.reporterCode !== targetReporterId) continue;
    if (r.flowCode !== 'X') continue;

    const valB = round(r.primaryValue / 1e9, 3);
    if (valB <= 0) continue;

    const period = r.period;
    if (!result[period]) {
      result[period] = {
        goodsExports: {},
        partnerGoodsExports: {},
      };
    }

    const chStr = r.cmdCode.padStart(2, '0');

    if (r.partnerCode === 0) {
      result[period].goodsExports[chStr] = round((result[period].goodsExports[chStr] || 0) + valB, 3);
    } else {
      const rawCode = COUNTRY_BY_ID.get(r.partnerCode)?.code || (partnerCodeResolver ? partnerCodeResolver(r.partnerCode) : undefined);
      if (!rawCode) continue;

      const upperCode = rawCode.toUpperCase();
      if (STATISTICAL_PARTNER_CODES.has(upperCode)) continue;

      const pCode = resolveRegionCode(rawCode).toLowerCase();
      if (!pCode || STATISTICAL_PARTNER_CODES.has(pCode.toUpperCase())) continue;

      if (!result[period].partnerGoodsExports[pCode]) {
        result[period].partnerGoodsExports[pCode] = {};
      }
      result[period].partnerGoodsExports[pCode][chStr] = round((result[period].partnerGoodsExports[pCode][chStr] || 0) + valB, 3);
    }
  }

  return result;
}

type ServiceRow = { reporterCode: number; period: string; flowCode: string; cmdCode: string; primaryValue: number };

/**
 * STAGE 1: Synchronize Macroeconomic Indicators (IMF DataMapper WEO)
 * Fetches all 11 indicators for all countries that have missing macro indicators.
 * Independent of UN Comtrade rate limits.
 */
export async function syncMacroStage(cache: CountryPipelineCache, catalog: AvailabilityCatalog, countriesToSync: CountryEntry[]): Promise<boolean> {
  const stage = getPipelineLogger('country').stage(1, 'Macro');
  const imfChanged = Boolean(catalog?.imfLastModified && cache.meta?.imfLastModified !== catalog.imfLastModified);

  const countriesNeedingMacro = countriesToSync.filter((c) => {
    const existing = cache.countries[c.code];
    return !existing || !Object.values(existing.years || {}).some((y) => y.ngdpd != null) || imfChanged;
  });

  if (countriesNeedingMacro.length === 0) {
    stage.info('All macroeconomic indicators are up to date.');
    return false;
  }

  stage.info(`Fetching IMF WEO indicators for ${countriesNeedingMacro.length} countries...`);
  let hasChanges = false;

  for (let i = 0; i < countriesNeedingMacro.length; i++) {
    const country = countriesNeedingMacro[i];
    const indicators = await fetchImfIndicators(country.iso3);
    if (!indicators || Object.keys(indicators).length === 0) continue;

    if (!cache.countries[country.code]) {
      cache.countries[country.code] = { code: country.code, years: {} };
    }
    const profile = cache.countries[country.code];

    const allYears = new Set<string>();
    for (const rec of Object.values(indicators)) {
      if (rec) for (const y of Object.keys(rec)) allYears.add(y);
    }

    for (const yStr of allYears) {
      if (!profile.years[yStr]) profile.years[yStr] = {};
      const y = profile.years[yStr];
      if (indicators.NGDPD?.[yStr] !== undefined) y.ngdpd = indicators.NGDPD[yStr];
      if (indicators.NGDP_RPCH?.[yStr] !== undefined) y.rpch = indicators.NGDP_RPCH[yStr];
      if (indicators.NGDPDPC?.[yStr] !== undefined) y.dpc = indicators.NGDPDPC[yStr];
      if (indicators.PPPGDP?.[yStr] !== undefined) y.pppgdp = indicators.PPPGDP[yStr];
      if (indicators.G_X_G01_GDP_PT?.[yStr] !== undefined) y.gx = indicators.G_X_G01_GDP_PT[yStr];
      if (indicators.GGR_G01_GDP_PT?.[yStr] !== undefined) y.ggr = indicators.GGR_G01_GDP_PT[yStr];
      if (indicators.GGXCNL_NGDP?.[yStr] !== undefined) y.ggxcnl = indicators.GGXCNL_NGDP[yStr];
      if (indicators.GGXWDG_NGDP?.[yStr] !== undefined) y.ggxwdg = indicators.GGXWDG_NGDP[yStr];
      if (indicators.PCPIPCH?.[yStr] !== undefined) y.pcpipch = indicators.PCPIPCH[yStr];
      if (indicators.LUR?.[yStr] !== undefined) y.lur = indicators.LUR[yStr];
      if (indicators.BCA_NGDPD?.[yStr] !== undefined) y.bca = indicators.BCA_NGDPD[yStr];
    }

    hasChanges = true;
    if ((i + 1) % 10 === 0 || i === countriesNeedingMacro.length - 1) {
      stage.progress(i + 1, countriesNeedingMacro.length, 'countries synced');
      writeJsonAsync(DATA_FILE, cache);
    }
  }

  return hasChanges;
}

/**
 * STAGE 2: Synchronize Bilateral Merchandise Goods Exports (UN Comtrade AG2)
 * Parameters: reporterCode=1_country, flowCode=X, cmdCode=AG2 (partnerCode omitted to capture all historical & sovereign partners).
 * Strict batching: 1 country at a time, chunked by 4 years.
 * Pacing: 1 req/sec.
 */
export async function syncGoodsStage(cache: CountryPipelineCache, catalog: AvailabilityCatalog, partnersMap: Record<number, string>, countriesToSync: CountryEntry[]): Promise<boolean> {
  const stage = getPipelineLogger('country').stage(2, 'Goods');
  const targetYears = range(START_YEAR, CURRENT_YEAR);

  stage.info(`Checking bilateral goods for ${countriesToSync.length} countries (chunk size: ${CHUNK_SIZE_GOODS} years)...`);
  let hasChanges = false;

  for (let i = 0; i < countriesToSync.length; i++) {
    if (isComtradeQuotaExhausted()) {
      stage.warn('Comtrade quota exhausted. Stopping goods stage.');
      break;
    }

    const country = countriesToSync[i];
    const existing = cache.countries[country.code];
    const missing = detectMissingStreams(existing, targetYears, country.id, catalog);

    if (missing.goods.length === 0) continue;

    stage.progress(i + 1, countriesToSync.length, `${country.code.toUpperCase()} missing ${missing.goods.length} years of goods trade`);

    if (!cache.countries[country.code]) {
      cache.countries[country.code] = { code: country.code, years: {} };
    }
    const profile = cache.countries[country.code];
    const goodsChunks = chunkYears(
      missing.goods.sort((a, b) => a - b),
      CHUNK_SIZE_GOODS,
    );

    let countryChanged = false;

    for (let cIdx = 0; cIdx < goodsChunks.length; cIdx++) {
      const chunk = goodsChunks[cIdx];
      if (isComtradeQuotaExhausted()) break;
      const periodParam = chunk.join(',');
      const ag2Url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?period=${periodParam}&reporterCode=${country.id}&flowCode=X&partner2Code=0&customsCode=C00&motCode=0&cmdCode=AG2`;

      try {
        const res = await fetchComtradeWithPacer(ag2Url);
        if (res.ok) {
          const json = (await res.json()) as { data?: UnifiedAg2Row[] };
          const rows = json.data || [];

          stage.progress(i + 1, countriesToSync.length, `${country.code.toUpperCase()} chunk [${cIdx + 1}/${goodsChunks.length}] (${chunk[0]}..${chunk[chunk.length - 1]}): ${rows.length} rows`);

          // Initialize queried chunk years: confirmed no trade defaults to null
          for (const y of chunk) {
            const yStr = String(y);
            if (!profile.years[yStr]) profile.years[yStr] = {};
            if (profile.years[yStr].goodsExports === undefined) profile.years[yStr].goodsExports = null;
            if (profile.years[yStr].partnerGoodsExports === undefined) profile.years[yStr].partnerGoodsExports = null;
          }

          // Ingest rows (sparse dictionary of active trading partners only)
          const ingested = ingestUnifiedAg2Rows(rows, country.id, (id) => partnersMap[id]);
          for (const [yStr, ingData] of Object.entries(ingested)) {
            if (!profile.years[yStr]) profile.years[yStr] = {};
            profile.years[yStr].goodsExports = ingData.goodsExports;
            profile.years[yStr].partnerGoodsExports = ingData.partnerGoodsExports;
          }

          // Update checksums for successful years
          for (const y of chunk) {
            const yStr = String(y);
            const checksum = catalog.goodsChecksums.get(`${country.id}:${y}`);
            if (checksum !== undefined && profile.years[yStr]) {
              profile.years[yStr].goodsChecksum = checksum;
            }
          }

          countryChanged = true;
          hasChanges = true;
        } else {
          stage.warn(`${country.code.toUpperCase()} HTTP ${res.status} (${periodParam}): ${await res.text()}`);
        }
      } catch (err) {
        if (err instanceof HttpError && err.isQuotaExhausted) break;
        stage.warn(`${country.code.toUpperCase()} query failed (${periodParam}): ${err}`);
      }
    }

    if (countryChanged) {
      cache.countries[country.code] = profile;
      writeJsonAsync(DATA_FILE, cache);
    }
  }

  return hasChanges;
}

/**
 * STAGE 3: Synchronize Commercial Services Trade (UN Comtrade EBOPS)
 * Parameters: flowCode=M,X, partnerCode=0 (World total).
 * Multi-country batching: queries all countries needing services in 1 request per year chunk.
 * Pacing: 1 req/sec.
 */
export async function syncServicesStage(cache: CountryPipelineCache, catalog: AvailabilityCatalog, countriesToSync: CountryEntry[]): Promise<boolean> {
  const stage = getPipelineLogger('country').stage(3, 'Services');
  const targetYears = range(START_YEAR, CURRENT_YEAR);

  stage.info(`Checking commercial services for ${countriesToSync.length} countries...`);

  // 1. Collect which countries need services for which years
  const countryMissingMap = new Map<CountryEntry, number[]>();
  const allMissingYears = new Set<number>();

  for (const country of countriesToSync) {
    const existing = cache.countries[country.code];
    const missing = detectMissingStreams(existing, targetYears, country.id, catalog);
    if (missing.services.length > 0) {
      countryMissingMap.set(country, missing.services);
      for (const y of missing.services) allMissingYears.add(y);
    }
  }

  if (countryMissingMap.size === 0) {
    stage.info('All commercial services are up to date.');
    return false;
  }

  const sortedYears = Array.from(allMissingYears).sort((a, b) => a - b);
  const yearChunks = chunkYears(sortedYears, CHUNK_SIZE_SERVICES);
  let hasChanges = false;

  stage.info(`${countryMissingMap.size} countries missing services across ${yearChunks.length} period chunks.`);

  for (let cIdx = 0; cIdx < yearChunks.length; cIdx++) {
    if (isComtradeQuotaExhausted()) {
      stage.warn('Comtrade quota exhausted. Stopping services stage.');
      break;
    }

    const chunk = yearChunks[cIdx];
    const chunkCountries = countriesToSync.filter((c) => {
      const missing = countryMissingMap.get(c);
      return missing?.some((y) => chunk.includes(y));
    });

    if (chunkCountries.length === 0) continue;

    const reporterCodesParam = chunkCountries.map((c) => c.id).join(',');
    const periodParam = chunk.join(',');
    const serviceUrl = `https://comtradeapi.un.org/data/v1/get/S/A/EB?period=${periodParam}&reporterCode=${reporterCodesParam}&flowCode=M,X&partnerCode=0`;

    try {
      const sRes = await fetchComtradeWithPacer(serviceUrl);
      if (sRes.ok) {
        const sJson = (await sRes.json()) as { data?: ServiceRow[] };
        const rows = sJson.data || [];

        stage.progress(cIdx + 1, yearChunks.length, `Years ${chunk[0]}..${chunk[chunk.length - 1]} (${chunkCountries.length} countries): ${rows.length} rows`);

        // Initialize queried countries and years in this chunk: default to null
        for (const country of chunkCountries) {
          if (!cache.countries[country.code]) {
            cache.countries[country.code] = { code: country.code, years: {} };
          }
          const profile = cache.countries[country.code];
          const missing = countryMissingMap.get(country) || [];

          for (const y of chunk) {
            if (missing.includes(y)) {
              const yStr = String(y);
              if (!profile.years[yStr]) profile.years[yStr] = {};
              if (profile.years[yStr].servicesExports === undefined) profile.years[yStr].servicesExports = null;
              if (profile.years[yStr].servicesImports === undefined) profile.years[yStr].servicesImports = null;
            }
          }
        }

        // Ingest returned service rows with canonical EBOPS normalization
        for (const r of rows) {
          const country = COUNTRY_BY_ID.get(r.reporterCode);
          if (!country) continue;

          const normCmd = EBOPS_NORMALIZATION_MAP[r.cmdCode];
          if (!normCmd) continue;

          const valB = round(r.primaryValue / 1e9, 3);
          if (valB <= 0) continue;

          const profile = cache.countries[country.code];
          if (!profile) continue;

          const yStr = r.period;
          if (!profile.years[yStr]) profile.years[yStr] = {};

          if (r.flowCode === 'M') {
            if (!profile.years[yStr].servicesImports) profile.years[yStr].servicesImports = {};
            profile.years[yStr].servicesImports[normCmd] = round((profile.years[yStr].servicesImports[normCmd] || 0) + valB, 3);
          } else if (r.flowCode === 'X') {
            if (!profile.years[yStr].servicesExports) profile.years[yStr].servicesExports = {};
            profile.years[yStr].servicesExports[normCmd] = round((profile.years[yStr].servicesExports[normCmd] || 0) + valB, 3);
          }
        }

        // Update checksums and clean profiles
        for (const country of chunkCountries) {
          const profile = cache.countries[country.code];
          if (!profile) continue;
          const missing = countryMissingMap.get(country) || [];

          for (const y of chunk) {
            if (missing.includes(y)) {
              const yStr = String(y);
              const checksum = catalog.servicesChecksums.get(`${country.id}:${y}`);
              if (checksum !== undefined && profile.years[yStr]) {
                profile.years[yStr].servicesChecksum = checksum;
              }
            }
          }

          cache.countries[country.code] = profile;
        }

        hasChanges = true;
        writeJsonAsync(DATA_FILE, cache);
      } else {
        stage.warn(`HTTP ${sRes.status} (${periodParam}): ${await sRes.text()}`);
      }
    } catch (err) {
      if (err instanceof HttpError && err.isQuotaExhausted) break;
      stage.warn(`Query failed (${periodParam}): ${err}`);
    }
  }

  return hasChanges;
}

/** Fetches completely raw, uncalculated CountryProfile data from 1990 to CURRENT_YEAR for a single country. */
export async function fetchRawCountryProfile(
  countryCode: string,
  existing: RawCountryProfile | undefined,
  partnersMap?: Record<number, string>,
  catalog?: AvailabilityCatalog,
): Promise<RawCountryProfile | null> {
  const meta = COUNTRY_BY_CODE.get(countryCode.toLowerCase()) || COUNTRY_BY_ISO3.get(countryCode.toUpperCase());
  if (!meta) return existing ?? null;

  const fakeCache: CountryPipelineCache = {
    countries: { [meta.code]: existing || { code: meta.code, years: {} } },
  };
  const cat = catalog || (await fetchAvailabilityCatalog());
  const pMap = partnersMap || (await getPartnerAreasMap());

  await syncMacroStage(fakeCache, cat, [meta]);
  await syncGoodsStage(fakeCache, cat, pMap, [meta]);
  await syncServicesStage(fakeCache, cat, [meta]);

  return fakeCache.countries[meta.code] || null;
}

/** Loads existing Tier 1 raw country cache snapshot from data.json.br. */
async function loadCountryCache(): Promise<CountryPipelineCache> {
  if (await fileExists(DATA_FILE)) {
    try {
      const raw = await readJson<CountryPipelineCache | Record<string, RawCountryProfile>>(DATA_FILE);
      if ('countries' in raw && typeof raw.countries === 'object') {
        return raw as CountryPipelineCache;
      }
      return { countries: raw as Record<string, RawCountryProfile> };
    } catch {
      return { countries: {} };
    }
  }
  return { countries: {} };
}

/**
 * Computes bilateral trade category breakdowns (10 macro goods categories and 2-digit HS chapters)
 * for a specific trading partner in billion USD.
 */
function buildPartnerCategoryBreakdown(chMap: Record<string, number>): {
  macro: Record<string, number>;
  detailed: Record<string, number>;
} {
  const detList: [string, number][] = [];
  const macroMap: Record<string, number> = {};

  for (const [chStr, valB] of Object.entries(chMap)) {
    if (typeof valB === 'number' && valB > 0) {
      const code = chStr.padStart(2, '0');
      const val = round(valB, 2);
      detList.push([code, val]);

      const macroId = HS_TO_MACRO_MAP[code] || 'misc_instruments';
      macroMap[macroId] = (macroMap[macroId] || 0) + valB;
    }
  }

  detList.sort((a, b) => b[1] - a[1]);
  const detailed: Record<string, number> = {};
  for (const [code, val] of detList) {
    detailed[code] = val;
  }

  const macroList = Object.entries(macroMap)
    .map(([mId, mVal]) => [mId, round(mVal, 2)] as const)
    .sort((a, b) => b[1] - a[1]);
  const macro: Record<string, number> = {};
  for (const [mId, val] of macroList) {
    macro[mId] = val;
  }

  return { macro, detailed };
}

/** Converts raw country cache into a fully aggregated and formatted Tier 2 production dataset. */
export function buildProductionProfile(raw: RawCountryProfile, allCountries?: Record<string, RawCountryProfile>): CountryProfileData {
  const years = Object.keys(raw.years || {})
    .map(Number)
    .filter((y) => {
      if (y < START_YEAR || y > CURRENT_YEAR) return false;
      const yStr = String(y);
      const yData = raw.years[yStr];
      const hasGoods = (yData?.goodsExports && Object.keys(yData.goodsExports).length > 0) || (yData?.partnerGoodsExports && Object.keys(yData.partnerGoodsExports).length > 0);
      const hasServ = (yData?.servicesExports && Object.keys(yData.servicesExports).length > 0) || (yData?.servicesImports && Object.keys(yData.servicesImports).length > 0);
      const hasGdp = yData?.ngdpd != null;
      return hasGoods || hasServ || hasGdp;
    })
    .sort((a, b) => a - b);

  const timeline: CountryYearRecord[] = [];

  for (let i = 0; i < years.length; i++) {
    const yStr = String(years[i]);
    const yData = raw.years[yStr];
    if (!yData) {
      timeline.push({
        year: years[i],
        exports: { total: 0, goods: null, services: null, macro: {}, detailed: {}, partners: {} },
        imports: { total: 0, goods: null, services: null, macro: {}, detailed: {}, partners: {} },
        netBalanceUsd: null,
        macro: {
          gdpNominalUsd: null,
          gdpRealGrowthYoy: null,
          gdpPerCapitaUsd: null,
          gdpPppUsd: null,
          govExpenditureUsd: null,
          govExpenditurePctGdp: null,
          govRevenueUsd: null,
          govRevenuePctGdp: null,
          govBalanceUsd: null,
          govBalancePctGdp: null,
          govDebtUsd: null,
          govDebtPctGdp: null,
          inflationPct: null,
          unemploymentPct: null,
          currentAccountUsd: null,
          currentAccountPctGdp: null,
          growth: {
            gdpYoy: null,
            gdpDiffUsd: null,
            revenueYoy: null,
            revenueDiffUsd: null,
            expenditureYoy: null,
            expenditureDiffUsd: null,
            debtYoy: null,
            debtDiffUsd: null,
          },
        },
      });
      continue;
    }

    // Resolve symmetrical partner and category imports from allCountries
    let symmetricalCategoryImports: Record<string, number> | null = null;
    let symmetricalPartnerImports: Record<string, number> | null = null;
    const yearMacroImports: Record<string, Record<string, number>> = {};
    const yearDetImports: Record<string, Record<string, number>> = {};

    if (allCountries) {
      symmetricalCategoryImports = {};
      symmetricalPartnerImports = {};
      const cCode = raw.code.toLowerCase();

      for (const [pCode, pProfile] of Object.entries(allCountries)) {
        if (pCode.toLowerCase() === cCode) continue;
        const pYear = pProfile.years?.[yStr];
        if (!pYear) continue;

        const pGoods = pYear.partnerGoodsExports?.[cCode];
        if (pGoods) {
          let pTot = 0;
          for (const [chStr, valB] of Object.entries(pGoods)) {
            if (typeof valB === 'number' && valB > 0) {
              const key = chStr.padStart(2, '0');
              symmetricalCategoryImports[key] = round((symmetricalCategoryImports[key] || 0) + valB, 3);
              pTot = round(pTot + valB, 3);
            }
          }
          if (pTot > 0) {
            const pIsoUpper = pCode.toUpperCase();
            symmetricalPartnerImports[pIsoUpper] = pTot;

            const { macro, detailed } = buildPartnerCategoryBreakdown(pGoods);
            yearMacroImports[pIsoUpper] = macro;
            yearDetImports[pIsoUpper] = detailed;
          }
        }
      }
    }

    // 1. Calculate Physical Goods (HS chapters -> 10 goods categories)
    let yearGoodsX = 0;
    let yearGoodsM = 0;
    const yearMacroX: Record<string, number> = {};
    const yearMacroM: Record<string, number> = {};
    for (const id of TRADE_CATEGORY_IDS) {
      yearMacroX[id] = 0;
      yearMacroM[id] = 0;
    }

    const rawGoodsX = yData.goodsExports;
    const rawGoodsM = symmetricalCategoryImports;

    for (const ch of HS2_CHAPTERS) {
      const code = ch.code;
      const xVal = rawGoodsX?.[code] ?? null;
      const mVal = rawGoodsM?.[code] ?? null;

      const macroId = HS_TO_MACRO_MAP[code] || 'misc_instruments';
      if (xVal != null && xVal > 0) {
        yearGoodsX += xVal;
        yearMacroX[macroId] = (yearMacroX[macroId] || 0) + xVal;
      }
      if (mVal != null && mVal > 0) {
        yearGoodsM += mVal;
        yearMacroM[macroId] = (yearMacroM[macroId] || 0) + mVal;
      }
    }

    // 2. Calculate Commercial Services (EBOPS parent codes -> 7 services categories)
    let yearServX = 0;
    let hasServX = false;

    for (const [ebCode, val] of Object.entries(yData.servicesExports || {})) {
      if (val != null && val > 0) {
        const sCatId = EBOPS_TO_SERVICES_MAP[ebCode];
        if (sCatId) {
          hasServX = true;
          yearMacroX[sCatId] = (yearMacroX[sCatId] || 0) + val;
          yearServX += val;
        }
      }
    }

    let yearServM = 0;
    let hasServM = false;

    for (const [ebCode, val] of Object.entries(yData.servicesImports || {})) {
      if (val != null && val > 0) {
        const sCatId = EBOPS_TO_SERVICES_MAP[ebCode];
        if (sCatId) {
          hasServM = true;
          yearMacroM[sCatId] = (yearMacroM[sCatId] || 0) + val;
          yearServM += val;
        }
      }
    }

    const gX = yearGoodsX > 0 ? round(yearGoodsX, 3) : null;
    const gM = yearGoodsM > 0 ? round(yearGoodsM, 3) : null;
    const sX = hasServX ? round(yearServX, 3) : null;
    const sM = hasServM ? round(yearServM, 3) : null;

    // Combined Totals (Goods + Services)
    const totX = round((gX || 0) + (sX || 0), 3);
    const totM = round((gM || 0) + (sM || 0), 3);
    const netBalanceUsd = totX > 0 && totM > 0 ? round(totX - totM, 3) : null;

    // Macro categories: sorted descending by volume
    const catMacroXMap: Record<string, number> = {};
    const catMacroXList = TRADE_CATEGORY_IDS.filter((id) => yearMacroX[id] > 0)
      .map((id) => [id, round(yearMacroX[id], 2)] as const)
      .sort((a, b) => b[1] - a[1]);
    for (const [id, val] of catMacroXList) {
      catMacroXMap[id] = val;
    }

    const catMacroMMap: Record<string, number> = {};
    const catMacroMList = TRADE_CATEGORY_IDS.filter((id) => yearMacroM[id] > 0)
      .map((id) => [id, round(yearMacroM[id], 2)] as const)
      .sort((a, b) => b[1] - a[1]);
    for (const [id, val] of catMacroMList) {
      catMacroMMap[id] = val;
    }

    // Detailed categories: sorted descending by volume
    const catDetXMap: Record<string, number> = {};
    const catDetXList: [string, number][] = [];
    for (const ch of HS2_CHAPTERS) {
      const val = rawGoodsX?.[ch.code];
      if (val != null && val > 0) {
        catDetXList.push([ch.code, round(val, 2)]);
      }
    }
    if (yData.servicesExports) {
      for (const [eb, val] of Object.entries(yData.servicesExports)) {
        if (val != null && val > 0 && EBOPS_TO_SERVICES_MAP[eb]) {
          catDetXList.push([eb, round(val, 2)]);
        }
      }
    }
    catDetXList.sort((a, b) => b[1] - a[1]);
    for (const [code, val] of catDetXList) {
      catDetXMap[code] = val;
    }

    const catDetMMap: Record<string, number> = {};
    const catDetMList: [string, number][] = [];
    for (const ch of HS2_CHAPTERS) {
      const val = rawGoodsM?.[ch.code] ?? null;
      if (val != null && val > 0) {
        catDetMList.push([ch.code, round(val, 2)]);
      }
    }
    if (yData.servicesImports) {
      for (const [eb, val] of Object.entries(yData.servicesImports)) {
        if (val != null && val > 0 && EBOPS_TO_SERVICES_MAP[eb]) {
          catDetMList.push([eb, round(val, 2)]);
        }
      }
    }
    catDetMList.sort((a, b) => b[1] - a[1]);
    for (const [code, val] of catDetMList) {
      catDetMMap[code] = val;
    }

    // 3. Export ALL partner countries on the fly from partnerGoodsExports
    const pX: [string, number][] = [];
    const pXMap: Record<string, CountryPartnerTradeRecord> = {};

    if (yData.partnerGoodsExports) {
      for (const [pIso, chMap] of Object.entries(yData.partnerGoodsExports)) {
        if (!chMap) continue;
        let sumVal = 0;
        for (const val of Object.values(chMap)) {
          if (typeof val === 'number' && val > 0) sumVal += val;
        }
        if (sumVal > 0) {
          const pIsoUpper = pIso.toUpperCase();
          const roundedVal = round(sumVal, 2);
          pX.push([pIsoUpper, roundedVal]);

          const { macro, detailed } = buildPartnerCategoryBreakdown(chMap);
          pXMap[pIsoUpper] = {
            total: roundedVal,
            macro,
            detailed,
          };
        }
      }
    }

    const sortedPXMap: Record<string, CountryPartnerTradeRecord> = {};
    for (const [pIsoUpper] of pX.sort((a, b) => b[1] - a[1])) {
      sortedPXMap[pIsoUpper] = pXMap[pIsoUpper];
    }

    const sortedPMMap: Record<string, CountryPartnerTradeRecord> = {};
    const pMList = Object.entries(symmetricalPartnerImports || {}).filter(([, val]) => val > 0);
    const sortedPMList = pMList.sort((a, b) => b[1] - a[1]);

    for (const [pIsoUpper, pTot] of sortedPMList) {
      const roundedVal = round(pTot, 2);
      sortedPMMap[pIsoUpper] = {
        total: roundedVal,
        macro: yearMacroImports[pIsoUpper] || {},
        detailed: yearDetImports[pIsoUpper] || {},
      };
    }

    // 4. Macroeconomic indicators from IMF WEO
    const gdpNominal = yData.ngdpd != null ? round(yData.ngdpd, 2) : null;
    const gx = yData.gx != null ? round(yData.gx, 2) : null;
    const ggr = yData.ggr != null ? round(yData.ggr, 2) : null;
    const ggxcnl = yData.ggxcnl != null ? round(yData.ggxcnl, 2) : null;
    const ggxwdg = yData.ggxwdg != null ? round(yData.ggxwdg, 1) : null;
    const bca = yData.bca != null ? round(yData.bca, 2) : null;

    const govExpUsd = gdpNominal != null && gx != null ? round((gdpNominal * gx) / 100, 2) : null;
    const govRevUsd = gdpNominal != null && ggr != null ? round((gdpNominal * ggr) / 100, 2) : null;
    const govBalUsd = gdpNominal != null && ggxcnl != null ? round((gdpNominal * ggxcnl) / 100, 2) : null;
    const govDebtUsd = gdpNominal != null && ggxwdg != null ? round((gdpNominal * ggxwdg) / 100, 2) : null;
    const currAccUsd = gdpNominal != null && bca != null ? round((gdpNominal * bca) / 100, 2) : null;

    const prevMacro = timeline[i - 1]?.macro;
    const calcYoy = (c: number | null, p: number | null) => (c == null || p == null || p === 0 ? null : round(((c - p) / Math.abs(p)) * 100, 1));
    const calcDiff = (c: number | null, p: number | null) => (c == null || p == null ? null : round(c - p, 2));

    const macroYear: CountryMacroYear = {
      gdpNominalUsd: gdpNominal,
      gdpRealGrowthYoy: yData.rpch != null ? round(yData.rpch, 2) : null,
      gdpPerCapitaUsd: yData.dpc != null ? round(yData.dpc, 1) : null,
      gdpPppUsd: yData.pppgdp != null ? round(yData.pppgdp, 2) : null,
      govExpenditureUsd: govExpUsd,
      govExpenditurePctGdp: gx,
      govRevenueUsd: govRevUsd,
      govRevenuePctGdp: ggr,
      govBalanceUsd: govBalUsd,
      govBalancePctGdp: ggxcnl,
      govDebtUsd: govDebtUsd,
      govDebtPctGdp: ggxwdg,
      inflationPct: yData.pcpipch != null ? round(yData.pcpipch, 2) : null,
      unemploymentPct: yData.lur != null ? round(yData.lur, 2) : null,
      currentAccountUsd: currAccUsd,
      currentAccountPctGdp: bca,
      growth: {
        gdpYoy: calcYoy(gdpNominal, prevMacro?.gdpNominalUsd ?? null),
        gdpDiffUsd: calcDiff(gdpNominal, prevMacro?.gdpNominalUsd ?? null),
        revenueYoy: calcYoy(govRevUsd, prevMacro?.govRevenueUsd ?? null),
        revenueDiffUsd: calcDiff(govRevUsd, prevMacro?.govRevenueUsd ?? null),
        expenditureYoy: calcYoy(govExpUsd, prevMacro?.govExpenditureUsd ?? null),
        expenditureDiffUsd: calcDiff(govExpUsd, prevMacro?.govExpenditureUsd ?? null),
        debtYoy: calcYoy(govDebtUsd, prevMacro?.govDebtUsd ?? null),
        debtDiffUsd: calcDiff(govDebtUsd, prevMacro?.govDebtUsd ?? null),
      },
    };

    timeline.push({
      year: years[i],
      exports: {
        total: totX > 0 ? totX : (gX ?? 0),
        goods: gX,
        services: sX,
        macro: catMacroXMap,
        detailed: catDetXMap,
        partners: sortedPXMap,
      },
      imports: {
        total: totM > 0 ? totM : (gM ?? 0),
        goods: gM,
        services: sM,
        macro: catMacroMMap,
        detailed: catDetMMap,
        partners: sortedPMMap,
      },
      netBalanceUsd,
      macro: macroYear,
    });
  }

  // 5. Precompute sorted rankings for interactive toolbar selectors
  let latestTradeIdx = timeline.length - 1;
  while (latestTradeIdx >= 0) {
    const x = timeline[latestTradeIdx].exports.total;
    const m = timeline[latestTradeIdx].imports.total;
    if (x > 0 || m > 0) break;
    latestTradeIdx--;
  }
  if (latestTradeIdx < 0) latestTradeIdx = timeline.length - 1;

  const latestYear = timeline[latestTradeIdx];

  const allMacroTotals: Record<string, number> = {};
  const latestMacroMap: Record<string, number> = {};
  if (latestYear) {
    for (const [id, val] of Object.entries(latestYear.exports.macro)) {
      latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
    }
    for (const [id, val] of Object.entries(latestYear.imports.macro)) {
      latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
    }
  }
  for (const y of timeline) {
    for (const [id, val] of Object.entries(y.exports.macro)) {
      allMacroTotals[id] = (allMacroTotals[id] || 0) + val;
    }
    for (const [id, val] of Object.entries(y.imports.macro)) {
      allMacroTotals[id] = (allMacroTotals[id] || 0) + val;
    }
  }

  const activeMacro: [TradeCategoryId, number][] = Object.keys(allMacroTotals).map((id) => [id as TradeCategoryId, round(latestMacroMap[id] || 0, 1)]);
  activeMacro.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allMacroTotals[b[0]] || 0) - (allMacroTotals[a[0]] || 0);
  });

  const allDetailedTotals: Record<string, number> = {};
  const latestDetailedMap: Record<string, number> = {};
  if (latestYear) {
    for (const [code, val] of Object.entries(latestYear.exports.detailed)) {
      latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
    }
    for (const [code, val] of Object.entries(latestYear.imports.detailed)) {
      latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
    }
  }
  for (const y of timeline) {
    for (const [code, val] of Object.entries(y.exports.detailed)) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
    for (const [code, val] of Object.entries(y.imports.detailed)) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
  }

  const activeDetailed: [string, number][] = Object.keys(allDetailedTotals).map((code) => [code, round(latestDetailedMap[code] || 0, 1)]);
  activeDetailed.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allDetailedTotals[b[0]] || 0) - (allDetailedTotals[a[0]] || 0);
  });

  let latestPartnerIdx = timeline.length - 1;
  while (latestPartnerIdx >= 0) {
    const pX = timeline[latestPartnerIdx].exports.partners;
    const pM = timeline[latestPartnerIdx].imports.partners;
    if (Object.keys(pX).length > 0 || Object.keys(pM).length > 0) break;
    latestPartnerIdx--;
  }
  if (latestPartnerIdx < 0) latestPartnerIdx = 0;

  const latestPartnerYear = timeline[latestPartnerIdx];
  const latestPartnerMap: Record<string, number> = {};
  if (latestPartnerYear) {
    for (const [pIso, rec] of Object.entries(latestPartnerYear.exports.partners)) {
      latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + rec.total;
    }
    for (const [pIso, rec] of Object.entries(latestPartnerYear.imports.partners)) {
      latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + rec.total;
    }
  }

  const allPartnersTotalMap: Record<string, number> = {};
  for (const y of timeline) {
    for (const [pIso, rec] of Object.entries(y.exports.partners)) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + rec.total;
    }
    for (const [pIso, rec] of Object.entries(y.imports.partners)) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + rec.total;
    }
  }

  const activePartners: [string, number][] = Object.keys(allPartnersTotalMap).map((code) => [code, round(latestPartnerMap[code] || 0, 1)]);
  activePartners.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allPartnersTotalMap[b[0]] || 0) - (allPartnersTotalMap[a[0]] || 0);
  });

  return {
    code: raw.code,
    years,
    activeMacro,
    activeDetailed,
    activePartners,
    timeline,
  };
}

/** Exports all individual country datasets and toolbar metadata to site/public/data/country. */
export async function exportCountryDatasets(countries: Record<string, RawCountryProfile>): Promise<void> {
  const countryRank = new Map(SUPPORTED_COUNTRIES.map((code, idx) => [code, idx]));

  // Filter only countries that have both trade years data and macro indicators
  const completeCountries = Object.entries(countries).filter(([_, rawData]) => {
    const yearsCount = Object.keys(rawData.years || {}).length;
    const hasMacro = Object.values(rawData.years || {}).some((y) => y.ngdpd != null);
    return yearsCount > 0 && hasMacro;
  });

  const countryList: string[] = completeCountries.map(([code]) => code).sort((a, b) => (countryRank.get(a) ?? 999) - (countryRank.get(b) ?? 999));

  const gdpMap: Record<string, number> = {};
  let minYear = CURRENT_YEAR;
  let maxYear = START_YEAR;
  let hasAnyYear = false;

  for (const [code, rawData] of completeCountries) {
    const profile = buildProductionProfile(rawData, countries);
    await exportProjectMeta('country', profile, `${code.toLowerCase()}.json`);

    let latestGdp: number | undefined;
    for (let i = profile.timeline.length - 1; i >= 0; i--) {
      const val = profile.timeline[i].macro.gdpNominalUsd;
      if (val != null) {
        latestGdp = val;
        break;
      }
    }
    const val = latestGdp ?? COUNTRY_BY_CODE.get(code)?.gdp;
    if (val != null) {
      gdpMap[code] = round(val, 1);
    }

    if (profile.years.length > 0) {
      const pMin = profile.years[0];
      const pMax = profile.years[profile.years.length - 1];
      if (pMin < minYear) minYear = pMin;
      if (pMax > maxYear) maxYear = pMax;
      hasAnyYear = true;
    }
  }

  if (!hasAnyYear) {
    minYear = START_YEAR;
    maxYear = CURRENT_YEAR - 1;
  }
  const defaultPeriod: [number, number] = [Math.max(minYear, maxYear - 5), maxYear];

  const toolbarMeta: CountryToolbarMeta = {
    countries: countryList,
    gdp: gdpMap,
    minYear,
    maxYear,
    defaultPeriod,
    categories: COUNTRY_CATEGORIES_META,
  };

  await exportProjectMeta('country', toolbarMeta, 'toolbar-meta.json');
  await updateMetadata('country');

  const exportLogger = getPipelineLogger('country');
  exportLogger.exported(`${countryList.length} complete country profiles and toolbar-meta.json`);
}

/** Runs the standalone Country ETL Pipeline checking 1990..CURRENT_YEAR dynamically with smart incremental fetching. */
export async function runCountryPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'country',
    async () => {
      const logger = getPipelineLogger('country');
      logger.start('Country');

      const cache = await loadCountryCache();
      const force = forceUpdate || isUpdate();
      if (force) {
        logger.info('Force update requested (-u): resetting data.json.br cache to re-download all countries from scratch...');
        cache.countries = {};
        delete cache.meta;
      }

      const targetYears = range(START_YEAR, CURRENT_YEAR);
      const catalog = await fetchAvailabilityCatalog();

      // 1. Identify which countries have missing streams or updated checksums
      const countriesNeedingUpdate = COUNTRIES.filter((c) => {
        const existing = cache.countries[c.code];
        return force || !isCountryComplete(existing, targetYears, c.id, catalog, cache.meta?.imfLastModified);
      });

      if (countriesNeedingUpdate.length > 0) {
        logger.stage('Init', `Found ${countriesNeedingUpdate.length} countries needing update.`);
        const partnersMap = await getPartnerAreasMap();

        // Stage 1: Macroeconomic Indicators (IMF DataMapper WEO)
        const macroChanged = await syncMacroStage(cache, catalog, countriesNeedingUpdate);

        // Stage 2: Bilateral Merchandise Goods Exports (UN Comtrade AG2)
        const goodsChanged = await syncGoodsStage(cache, catalog, partnersMap, countriesNeedingUpdate);

        // Stage 3: Commercial Services Exports (UN Comtrade EBOPS)
        const servicesChanged = await syncServicesStage(cache, catalog, countriesNeedingUpdate);

        const imfChanged = Boolean(catalog.imfLastModified && catalog.imfLastModified !== cache.meta?.imfLastModified);
        let hasChanges = macroChanged || goodsChanged || servicesChanged;

        if (imfChanged) {
          cache.meta = {
            imfLastModified: catalog.imfLastModified,
            lastUpdated: new Date().toISOString(),
          };
          hasChanges = true;
        } else if (hasChanges) {
          cache.meta = {
            ...cache.meta,
            lastUpdated: new Date().toISOString(),
          };
        }

        if (hasChanges) {
          writeJsonAsync(DATA_FILE, cache);
        }

        await flushPendingJsonSaves(DATA_FILE);
        if (hasChanges) {
          logger.success(`Updated raw L1 cache saved to ${DATA_FILE}`);
        }
      }

      if (Object.keys(cache.countries).length === 0) {
        logger.warn('No country profiles found in cache! Run with -u to populate.');
        return;
      }

      await exportCountryDatasets(cache.countries);
      logger.complete(`${Object.keys(cache.countries).length} countries ready.`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runCountryPipeline(isUpdate(), isVerbose()).catch((err) => {
    getPipelineLogger('country').error('Fatal Country pipeline error:', err);
    process.exit(1);
  });
}
