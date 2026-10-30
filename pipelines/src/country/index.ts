import fs from 'node:fs/promises';
import path from 'node:path';
import type { CountryToolbarMeta } from '@graphs/shared/types/country';
import { type CountryMacroYear, type CountryPartnerTradeRecord, type CountryProfileData, type CountryYearRecord, TRADE_CATEGORY_IDS, type TradeCategoryId } from '@graphs/shared/types/country';
import { COMTRADE_API_KEY } from '@/utils/env';
import { ensurePipelineL1, fileExists, flushPendingJsonSaves, getRawDataDir, readJson, writeJsonAsyncToR2, writeJsonAsyncToSite } from '@/utils/fs';
import { fetchWithRetry, HttpError } from '@/utils/http';
import { getPipelineLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { range, round } from '@/utils/math';
import { updateMetadata } from '@/utils/metadata';
import { resolveRegionCode } from '@/utils/region';
import { COUNTRY_CATEGORIES_META, EBOPS_NORMALIZATION_MAP, EBOPS_TO_SERVICES_MAP, HS_TO_MACRO_MAP, HS2_CHAPTERS } from './classification';
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_BY_ID, COUNTRY_BY_ISO3, type CountryEntry, SUPPORTED_COUNTRIES } from './countries';

const DATA_DIR = getRawDataDir('country');

/** Returns the absolute path to a Tier 1 raw country snapshot. */
export function getCountryDataPath(code: string): string {
  return path.join(DATA_DIR, `${code.toLowerCase()}.json`);
}

/** Saves an individual country profile asynchronously to Tier 1 snapshot storage. */
export function saveCountryProfile(profile: RawCountryProfile): Promise<void> {
  return writeJsonAsyncToR2(getCountryDataPath(profile.code), profile);
}

export { COUNTRIES, SUPPORTED_COUNTRIES };

/** Earliest calendar year included in historical country trade and macroeconomic series. @default 1990 */
export const START_YEAR = 1990;
/** Latest completed calendar year queried from upstream trade and macroeconomic sources. */
export const CURRENT_YEAR = new Date().getFullYear() - 1;
/** Number of calendar years batched per UN Comtrade bilateral goods request. @default 4 */
export const CHUNK_SIZE_GOODS = 4;
/** Number of calendar years batched per UN Comtrade commercial services request. @default 12 */
export const CHUNK_SIZE_SERVICES = 12;
/** Maximum number of reporter countries batched per UN Comtrade commercial services request. @default 40 */
export const BATCH_SIZE_SERVICES_COUNTRIES = 40;
/** Default period chunk size for UN Comtrade queries. @default 12 */
export const CHUNK_SIZE = 12;

const comtradeKey = COMTRADE_API_KEY;
const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};

/** UN Comtrade statistical, accounting, and unspecified non-country area aggregates mapped to Others. */
export const STATISTICAL_PARTNER_CODES = new Set([
  '_X',
  'XX',
  'X1',
  'X2',
  'E19',
  'F19',
  'O19',
  'A79',
  'A59',
  'F97',
  'E29',
  'A49',
  'F49',
  'R91',
  'R20',
  'NTZ',
  '_AC',
  '_CI',
  '_SM',
  '_TK',
  '_WI',
  '_ZP',
]);

/** Raw annual trade and macroeconomic streams for a single country and calendar year in Tier 1 storage. */
export interface RawYearData {
  /** Raw merchandise goods exports by 2-digit HS chapter in USD: { "01": 1250000, ... } or null if no trade reported */
  goodsExports?: Record<string, number> | null;
  /** Raw commercial services exports by 3-digit EBOPS code in USD: { "205": 91000000, ... } or null if no trade reported */
  servicesExports?: Record<string, number> | null;
  /** Raw commercial services imports by 3-digit EBOPS code in USD: { "205": 45200000, ... } or null if no trade reported */
  servicesImports?: Record<string, number> | null;
  /** Bilateral merchandise goods exports by active partner code and 2-digit HS chapter in USD: { "cn": { "84": 13900000, ... }, ... } or null if no trade reported */
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

/** Raw Tier 1 country snapshot containing multi-decade trade and macroeconomic series. */
export interface RawCountryProfile {
  code: string;
  imfLastModified?: string;
  lastUpdated?: string;
  years: Record<string, RawYearData>;
}

/** In-memory dictionary of Tier 1 country snapshots keyed by lowercase ISO-2 code. */
export interface CountryPipelineCache {
  countries: Record<string, RawCountryProfile>;
}

/** Upstream dataset checksums and modification metadata for smart incremental sync. */
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

/** Raw UN Comtrade 2-digit HS chapter export row. */
export interface UnifiedAg2Row {
  reporterCode: number;
  partnerCode: number;
  period: string;
  flowCode: string;
  cmdCode: string;
  primaryValue: number;
}

/** Aggregated annual goods exports and bilateral partner breakdown for a single period. */
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

    const val = r.primaryValue;
    if (!val || val <= 0) continue;

    const period = r.period;
    if (!result[period]) {
      result[period] = {
        goodsExports: {},
        partnerGoodsExports: {},
      };
    }

    const chStr = r.cmdCode.padStart(2, '0');

    if (r.partnerCode === 0) {
      result[period].goodsExports[chStr] = (result[period].goodsExports[chStr] || 0) + val;
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
      result[period].partnerGoodsExports[pCode][chStr] = (result[period].partnerGoodsExports[pCode][chStr] || 0) + val;
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

  const countriesNeedingMacro = countriesToSync.filter((c) => {
    const existing = cache.countries[c.code];
    const imfChanged = Boolean(catalog?.imfLastModified && existing?.imfLastModified !== catalog.imfLastModified);
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
    profile.imfLastModified = catalog.imfLastModified;
    profile.lastUpdated = new Date().toISOString();

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
    saveCountryProfile(profile);
    if ((i + 1) % 10 === 0 || i === countriesNeedingMacro.length - 1) {
      stage.progress(i + 1, countriesNeedingMacro.length, 'countries synced');
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
            profile.years[yStr].goodsExports = null;
            profile.years[yStr].partnerGoodsExports = null;
          }

          // Ingest rows (sparse dictionary of active trading partners only; empty objects default to null)
          const ingested = ingestUnifiedAg2Rows(rows, country.id, (id) => partnersMap[id]);
          for (const [yStr, ingData] of Object.entries(ingested)) {
            if (!profile.years[yStr]) profile.years[yStr] = {};
            profile.years[yStr].goodsExports = Object.keys(ingData.goodsExports).length > 0 ? ingData.goodsExports : null;
            profile.years[yStr].partnerGoodsExports = Object.keys(ingData.partnerGoodsExports).length > 0 ? ingData.partnerGoodsExports : null;
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
      profile.lastUpdated = new Date().toISOString();
      cache.countries[country.code] = profile;
      saveCountryProfile(profile);
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

  interface ServicesTask {
    chunk: number[];
    batchCountries: CountryEntry[];
  }

  const tasks: ServicesTask[] = [];
  for (const chunk of yearChunks) {
    const chunkCountries = countriesToSync.filter((c) => {
      const missing = countryMissingMap.get(c);
      return missing?.some((y) => chunk.includes(y));
    });
    if (chunkCountries.length === 0) continue;
    const countryBatches = chunkArray(chunkCountries, BATCH_SIZE_SERVICES_COUNTRIES);
    for (const batch of countryBatches) {
      tasks.push({ chunk, batchCountries: batch });
    }
  }

  stage.info(`${countryMissingMap.size} countries missing services across ${tasks.length} requests (${yearChunks.length} period chunks, batch size ${BATCH_SIZE_SERVICES_COUNTRIES}).`);

  for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
    if (isComtradeQuotaExhausted()) {
      stage.warn('Comtrade quota exhausted. Stopping services stage.');
      break;
    }

    const { chunk, batchCountries } = tasks[tIdx];
    const reporterCodesParam = batchCountries.map((c) => c.id).join(',');
    const periodParam = chunk.join(',');
    const serviceUrl = `https://comtradeapi.un.org/data/v1/get/S/A/EB?period=${periodParam}&reporterCode=${reporterCodesParam}&flowCode=M,X&partnerCode=0`;

    try {
      const sRes = await fetchComtradeWithPacer(serviceUrl);
      if (sRes.ok) {
        const sJson = (await sRes.json()) as { data?: ServiceRow[] };
        const rows = sJson.data || [];

        if (rows.length >= 100000) {
          stage.warn(`Hit Comtrade 100,000 row ceiling! Data truncated for periods ${periodParam} (${batchCountries.length} countries). Reduce batch size.`);
        }

        stage.progress(tIdx + 1, tasks.length, `Years ${chunk[0]}..${chunk[chunk.length - 1]} (${batchCountries.length} countries): ${rows.length} rows`);

        // Initialize queried countries and years in this batch: confirmed no trade defaults to null
        for (const country of batchCountries) {
          if (!cache.countries[country.code]) {
            cache.countries[country.code] = { code: country.code, years: {} };
          }
          const profile = cache.countries[country.code];
          const missing = countryMissingMap.get(country) || [];

          for (const y of chunk) {
            if (missing.includes(y)) {
              const yStr = String(y);
              if (!profile.years[yStr]) profile.years[yStr] = {};
              profile.years[yStr].servicesExports = null;
              profile.years[yStr].servicesImports = null;
            }
          }
        }

        // Ingest returned service rows with canonical EBOPS normalization
        for (const r of rows) {
          const country = COUNTRY_BY_ID.get(r.reporterCode);
          if (!country) continue;

          const missing = countryMissingMap.get(country);
          if (!missing?.includes(Number(r.period))) continue;

          const normCmd = EBOPS_NORMALIZATION_MAP[r.cmdCode];
          if (!normCmd) continue;

          const val = r.primaryValue;
          if (!val || val <= 0) continue;

          const profile = cache.countries[country.code];
          if (!profile) continue;

          const yStr = r.period;
          if (!profile.years[yStr]) profile.years[yStr] = {};

          if (r.flowCode === 'M') {
            if (!profile.years[yStr].servicesImports) profile.years[yStr].servicesImports = {};
            profile.years[yStr].servicesImports[normCmd] = (profile.years[yStr].servicesImports[normCmd] || 0) + val;
          } else if (r.flowCode === 'X') {
            if (!profile.years[yStr].servicesExports) profile.years[yStr].servicesExports = {};
            profile.years[yStr].servicesExports[normCmd] = (profile.years[yStr].servicesExports[normCmd] || 0) + val;
          }
        }

        // Update checksums and clean profiles
        for (const country of batchCountries) {
          const profile = cache.countries[country.code];
          if (!profile) continue;
          const missing = countryMissingMap.get(country) || [];

          for (const y of chunk) {
            if (missing.includes(y)) {
              const yStr = String(y);
              const yObj = profile.years[yStr];
              if (yObj) {
                if (yObj.servicesExports && Object.keys(yObj.servicesExports).length === 0) yObj.servicesExports = null;
                if (yObj.servicesImports && Object.keys(yObj.servicesImports).length === 0) yObj.servicesImports = null;
                const checksum = catalog.servicesChecksums.get(`${country.id}:${y}`);
                if (checksum !== undefined) {
                  yObj.servicesChecksum = checksum;
                }
              }
            }
          }

          profile.lastUpdated = new Date().toISOString();
          cache.countries[country.code] = profile;
          saveCountryProfile(profile);
        }

        hasChanges = true;
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

/** Loads existing Tier 1 raw country snapshots from pipelines/raw/country/{code}.json. */
export async function loadCountryCache(): Promise<CountryPipelineCache> {
  const cache: CountryPipelineCache = { countries: {} };
  if (!(await fileExists(DATA_DIR))) {
    return cache;
  }
  try {
    const entries = await fs.readdir(DATA_DIR);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));
    await Promise.all(
      jsonFiles.map(async (f) => {
        try {
          const profile = await readJson<RawCountryProfile>(path.join(DATA_DIR, f));
          if (profile?.code) {
            cache.countries[profile.code.toLowerCase()] = profile;
          }
        } catch (err) {
          getPipelineLogger('country').warn(`Failed to read country snapshot ${f}: ${err}`);
        }
      }),
    );
  } catch (err) {
    getPipelineLogger('country').warn(`Failed to read country data directory: ${err}`);
  }
  return cache;
}

/**
 * Computes bilateral trade category breakdowns (10 macro goods categories and 2-digit HS chapters)
 * for a specific trading partner in USD.
 */
function buildPartnerCategoryBreakdown(chMap: Record<string, number>): {
  m: Record<string, number>;
  d: Record<string, number>;
} {
  const detList: [string, number][] = [];
  const macroMap: Record<string, number> = {};

  for (const [chStr, valUsd] of Object.entries(chMap)) {
    if (typeof valUsd === 'number' && valUsd > 0) {
      const code = chStr.padStart(2, '0');
      const roundedUsd = Math.round(valUsd);
      if (roundedUsd > 0) {
        detList.push([code, roundedUsd]);
      }

      const macroId = HS_TO_MACRO_MAP[code] || 'mi';
      macroMap[macroId] = (macroMap[macroId] || 0) + valUsd;
    }
  }

  detList.sort((a, b) => b[1] - a[1]);
  const d: Record<string, number> = {};
  for (const [code, val] of detList) {
    d[code] = val;
  }

  const macroList = Object.entries(macroMap)
    .map(([mId, mValUsd]) => [mId, Math.round(mValUsd)] as const)
    .filter(([, val]) => val > 0)
    .sort((a, b) => b[1] - a[1]);
  const m: Record<string, number> = {};
  for (const [mId, val] of macroList) {
    m[mId] = val;
  }

  return { m, d };
}

/** Pre-indexed symmetrical import data for a single target country and year. */
interface BilateralYearImports {
  categoryImports: Record<string, number>;
  partnerImports: Record<string, number>;
  macroImports: Record<string, Record<string, number>>;
  detImports: Record<string, Record<string, number>>;
}

/** Pre-indexed map of targetCountryCode -> yearStr -> BilateralYearImports. */
export type BilateralImportIndex = Record<string, Record<string, BilateralYearImports>>;

/**
 * Builds a single-pass O(E) inverted index of bilateral goods imports across all reporting countries.
 * Avoids scanning all countries x all years repeatedly for every country profile export.
 */
export function buildBilateralImportIndex(allCountries: Record<string, RawCountryProfile>): BilateralImportIndex {
  const index: BilateralImportIndex = {};

  for (const [pCode, pProfile] of Object.entries(allCountries)) {
    const pIsoLower = pCode.toLowerCase();
    for (const [yStr, pYear] of Object.entries(pProfile.years || {})) {
      if (!pYear?.partnerGoodsExports) continue;

      for (const [targetCode, pGoods] of Object.entries(pYear.partnerGoodsExports)) {
        if (!pGoods) continue;
        const cCode = targetCode.toLowerCase();
        if (cCode === pIsoLower) continue;

        let pTotUsd = 0;
        let bucket = index[cCode]?.[yStr];

        for (const [chStr, valUsd] of Object.entries(pGoods)) {
          if (typeof valUsd === 'number' && valUsd > 0) {
            if (!bucket) {
              if (!index[cCode]) index[cCode] = {};
              bucket = {
                categoryImports: {},
                partnerImports: {},
                macroImports: {},
                detImports: {},
              };
              index[cCode][yStr] = bucket;
            }
            const key = chStr.padStart(2, '0');
            bucket.categoryImports[key] = (bucket.categoryImports[key] || 0) + valUsd;
            pTotUsd += valUsd;
          }
        }

        if (pTotUsd > 0 && bucket) {
          bucket.partnerImports[pIsoLower] = pTotUsd;
          const { m, d } = buildPartnerCategoryBreakdown(pGoods);
          bucket.macroImports[pIsoLower] = m;
          bucket.detImports[pIsoLower] = d;
        }
      }
    }
  }

  return index;
}

/** Converts raw country cache into a fully aggregated and formatted Tier 2 production dataset. */
export function buildProductionProfile(raw: RawCountryProfile, allCountries?: Record<string, RawCountryProfile>, bilateralIndex?: BilateralImportIndex): CountryProfileData {
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
  const cCode = raw.code.toLowerCase();

  for (let i = 0; i < years.length; i++) {
    const yStr = String(years[i]);
    const yData = raw.years[yStr];
    if (!yData) {
      timeline.push({
        year: years[i],
        exports: { t: 0, goods: null, services: null, m: {}, d: {}, partners: {} },
        imports: { t: 0, goods: null, services: null, m: {}, d: {}, partners: {} },
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

    // Resolve symmetrical partner and category imports from bilateralIndex or allCountries
    let symmetricalCategoryImports: Record<string, number> | null = null;
    let symmetricalPartnerImports: Record<string, number> | null = null;
    let yearMacroImports: Record<string, Record<string, number>> = {};
    let yearDetImports: Record<string, Record<string, number>> = {};

    if (bilateralIndex) {
      const bucket = bilateralIndex[cCode]?.[yStr];
      symmetricalCategoryImports = bucket?.categoryImports || {};
      symmetricalPartnerImports = bucket?.partnerImports || {};
      yearMacroImports = bucket?.macroImports || {};
      yearDetImports = bucket?.detImports || {};
    } else if (allCountries) {
      symmetricalCategoryImports = {};
      symmetricalPartnerImports = {};

      for (const [pCode, pProfile] of Object.entries(allCountries)) {
        if (pCode.toLowerCase() === cCode) continue;
        const pYear = pProfile.years?.[yStr];
        if (!pYear) continue;

        const pGoods = pYear.partnerGoodsExports?.[cCode];
        if (pGoods) {
          let pTotUsd = 0;
          for (const [chStr, valUsd] of Object.entries(pGoods)) {
            if (typeof valUsd === 'number' && valUsd > 0) {
              const key = chStr.padStart(2, '0');
              symmetricalCategoryImports[key] = (symmetricalCategoryImports[key] || 0) + valUsd;
              pTotUsd += valUsd;
            }
          }
          if (pTotUsd > 0) {
            const pIsoLower = pCode.toLowerCase();
            symmetricalPartnerImports[pIsoLower] = pTotUsd;

            const { m, d } = buildPartnerCategoryBreakdown(pGoods);
            yearMacroImports[pIsoLower] = m;
            yearDetImports[pIsoLower] = d;
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
      const xValUsd = rawGoodsX?.[code] ?? null;
      const mValUsd = rawGoodsM?.[code] ?? null;

      const macroId = HS_TO_MACRO_MAP[code] || 'mi';
      if (xValUsd != null && xValUsd > 0) {
        yearGoodsX += xValUsd;
        yearMacroX[macroId] = (yearMacroX[macroId] || 0) + xValUsd;
      }
      if (mValUsd != null && mValUsd > 0) {
        yearGoodsM += mValUsd;
        yearMacroM[macroId] = (yearMacroM[macroId] || 0) + mValUsd;
      }
    }

    // 2. Calculate Commercial Services (EBOPS parent codes -> 7 services categories)
    let yearServX = 0;
    let hasServX = false;

    for (const [ebCode, valUsd] of Object.entries(yData.servicesExports || {})) {
      if (valUsd != null && valUsd > 0) {
        const sCatId = EBOPS_TO_SERVICES_MAP[ebCode];
        if (sCatId) {
          hasServX = true;
          yearMacroX[sCatId] = (yearMacroX[sCatId] || 0) + valUsd;
          yearServX += valUsd;
        }
      }
    }

    let yearServM = 0;
    let hasServM = false;

    for (const [ebCode, valUsd] of Object.entries(yData.servicesImports || {})) {
      if (valUsd != null && valUsd > 0) {
        const sCatId = EBOPS_TO_SERVICES_MAP[ebCode];
        if (sCatId) {
          hasServM = true;
          yearMacroM[sCatId] = (yearMacroM[sCatId] || 0) + valUsd;
          yearServM += valUsd;
        }
      }
    }

    const gX = yearGoodsX > 0 ? Math.round(yearGoodsX) : null;
    const gM = yearGoodsM > 0 ? Math.round(yearGoodsM) : null;
    const sX = hasServX ? Math.round(yearServX) : null;
    const sM = hasServM ? Math.round(yearServM) : null;

    // Combined Totals (Goods + Services) in USD
    const totX = (gX || 0) + (sX || 0);
    const totM = (gM || 0) + (sM || 0);
    const netBalanceUsd = totX > 0 && totM > 0 ? totX - totM : null;

    // Macro categories in USD: sorted descending by volume
    const catMacroXMap: Record<string, number> = {};
    const catMacroXList = TRADE_CATEGORY_IDS.filter((id) => yearMacroX[id] > 0)
      .map((id) => [id, Math.round(yearMacroX[id])] as const)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [id, val] of catMacroXList) {
      catMacroXMap[id] = val;
    }

    const catMacroMMap: Record<string, number> = {};
    const catMacroMList = TRADE_CATEGORY_IDS.filter((id) => yearMacroM[id] > 0)
      .map((id) => [id, Math.round(yearMacroM[id])] as const)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [id, val] of catMacroMList) {
      catMacroMMap[id] = val;
    }

    // Detailed categories in USD: sorted descending by volume
    const catDetXMap: Record<string, number> = {};
    const catDetXList: [string, number][] = [];
    for (const ch of HS2_CHAPTERS) {
      const valUsd = rawGoodsX?.[ch.code];
      if (valUsd != null && valUsd > 0) {
        const roundedUsd = Math.round(valUsd);
        if (roundedUsd > 0) catDetXList.push([ch.code, roundedUsd]);
      }
    }
    if (yData.servicesExports) {
      for (const [eb, valUsd] of Object.entries(yData.servicesExports)) {
        if (valUsd != null && valUsd > 0 && EBOPS_TO_SERVICES_MAP[eb]) {
          const roundedUsd = Math.round(valUsd);
          if (roundedUsd > 0) catDetXList.push([eb, roundedUsd]);
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
      const valUsd = rawGoodsM?.[ch.code] ?? null;
      if (valUsd != null && valUsd > 0) {
        const roundedUsd = Math.round(valUsd);
        if (roundedUsd > 0) catDetMList.push([ch.code, roundedUsd]);
      }
    }
    if (yData.servicesImports) {
      for (const [eb, valUsd] of Object.entries(yData.servicesImports)) {
        if (valUsd != null && valUsd > 0 && EBOPS_TO_SERVICES_MAP[eb]) {
          const roundedUsd = Math.round(valUsd);
          if (roundedUsd > 0) catDetMList.push([eb, roundedUsd]);
        }
      }
    }
    catDetMList.sort((a, b) => b[1] - a[1]);
    for (const [code, val] of catDetMList) {
      catDetMMap[code] = val;
    }

    // 3. Export ALL partner countries in USD on the fly from partnerGoodsExports
    const pX: [string, number][] = [];
    const pXMap: Record<string, CountryPartnerTradeRecord> = {};

    if (yData.partnerGoodsExports) {
      for (const [pIso, chMap] of Object.entries(yData.partnerGoodsExports)) {
        if (!chMap) continue;
        let sumValUsd = 0;
        for (const valUsd of Object.values(chMap)) {
          if (typeof valUsd === 'number' && valUsd > 0) sumValUsd += valUsd;
        }
        if (sumValUsd > 0) {
          const pIsoLower = pIso.toLowerCase();
          const roundedVal = Math.round(sumValUsd);
          if (roundedVal > 0) {
            pX.push([pIsoLower, roundedVal]);

            const { m, d } = buildPartnerCategoryBreakdown(chMap);
            pXMap[pIsoLower] = {
              t: roundedVal,
              m,
              d,
            };
          }
        }
      }
    }

    const sortedPXMap: Record<string, CountryPartnerTradeRecord> = {};
    for (const [pIsoLower] of pX.sort((a, b) => b[1] - a[1])) {
      sortedPXMap[pIsoLower] = pXMap[pIsoLower];
    }

    const sortedPMMap: Record<string, CountryPartnerTradeRecord> = {};
    const pMList = Object.entries(symmetricalPartnerImports || {}).filter(([, valUsd]) => valUsd > 0);
    const sortedPMList = pMList
      .map(([pIsoLower, pTotUsd]) => [pIsoLower, Math.round(pTotUsd)] as const)
      .filter(([, roundedVal]) => roundedVal > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [pIsoLower, roundedVal] of sortedPMList) {
      sortedPMMap[pIsoLower] = {
        t: roundedVal,
        m: yearMacroImports[pIsoLower] || {},
        d: yearDetImports[pIsoLower] || {},
      };
    }

    // 4. Macroeconomic indicators from IMF WEO in USD
    const gdpNominal = yData.ngdpd != null ? Math.round(yData.ngdpd * 1e9) : null;
    const gx = yData.gx != null ? round(yData.gx, 2) : null;
    const ggr = yData.ggr != null ? round(yData.ggr, 2) : null;
    const ggxcnl = yData.ggxcnl != null ? round(yData.ggxcnl, 2) : null;
    const ggxwdg = yData.ggxwdg != null ? round(yData.ggxwdg, 1) : null;
    const bca = yData.bca != null ? round(yData.bca, 2) : null;

    const govExpUsd = gdpNominal != null && gx != null ? Math.round((gdpNominal * gx) / 100) : null;
    const govRevUsd = gdpNominal != null && ggr != null ? Math.round((gdpNominal * ggr) / 100) : null;
    const govBalUsd = gdpNominal != null && ggxcnl != null ? Math.round((gdpNominal * ggxcnl) / 100) : null;
    const govDebtUsd = gdpNominal != null && ggxwdg != null ? Math.round((gdpNominal * ggxwdg) / 100) : null;
    const currAccUsd = gdpNominal != null && bca != null ? Math.round((gdpNominal * bca) / 100) : null;

    const prevRecord = timeline[i - 1];
    const prevMacro = prevRecord && prevRecord.year === years[i] - 1 ? prevRecord.macro : undefined;
    const calcYoy = (c: number | null, p: number | null) => (c == null || p == null || p === 0 ? null : round(((c - p) / Math.abs(p)) * 100, 1));
    const calcDiff = (c: number | null, p: number | null) => (c == null || p == null ? null : c - p);

    const macroYear: CountryMacroYear = {
      gdpNominalUsd: gdpNominal,
      gdpRealGrowthYoy: yData.rpch != null ? round(yData.rpch, 2) : null,
      gdpPerCapitaUsd: yData.dpc != null ? Math.round(yData.dpc) : null,
      gdpPppUsd: yData.pppgdp != null ? Math.round(yData.pppgdp * 1e9) : null,
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
        t: totX > 0 ? totX : (gX ?? 0),
        goods: gX,
        services: sX,
        m: catMacroXMap,
        d: catDetXMap,
        partners: sortedPXMap,
      },
      imports: {
        t: totM > 0 ? totM : (gM ?? 0),
        goods: gM,
        services: sM,
        m: catMacroMMap,
        d: catDetMMap,
        partners: sortedPMMap,
      },
      netBalanceUsd,
      macro: macroYear,
    });
  }

  // 5. Precompute sorted rankings for interactive toolbar selectors
  let latestTradeIdx = timeline.length - 1;
  while (latestTradeIdx >= 0) {
    const x = timeline[latestTradeIdx].exports.t;
    const m = timeline[latestTradeIdx].imports.t;
    if (x > 0 || m > 0) break;
    latestTradeIdx--;
  }
  if (latestTradeIdx < 0) latestTradeIdx = timeline.length - 1;

  const latestYear = timeline[latestTradeIdx];

  const allMacroTotals: Record<string, number> = {};
  const latestMacroMap: Record<string, number> = {};
  if (latestYear) {
    for (const [id, val] of Object.entries(latestYear.exports.m)) {
      latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
    }
    for (const [id, val] of Object.entries(latestYear.imports.m)) {
      latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
    }
  }
  for (const y of timeline) {
    for (const [id, val] of Object.entries(y.exports.m)) {
      allMacroTotals[id] = (allMacroTotals[id] || 0) + val;
    }
    for (const [id, val] of Object.entries(y.imports.m)) {
      allMacroTotals[id] = (allMacroTotals[id] || 0) + val;
    }
  }

  const activeMacro: [TradeCategoryId, number][] = Object.keys(allMacroTotals).map((id) => [id as TradeCategoryId, Math.round(latestMacroMap[id] || 0)]);
  activeMacro.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allMacroTotals[b[0]] || 0) - (allMacroTotals[a[0]] || 0);
  });

  const allDetailedTotals: Record<string, number> = {};
  const latestDetailedMap: Record<string, number> = {};
  if (latestYear) {
    for (const [code, val] of Object.entries(latestYear.exports.d)) {
      latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
    }
    for (const [code, val] of Object.entries(latestYear.imports.d)) {
      latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
    }
  }
  for (const y of timeline) {
    for (const [code, val] of Object.entries(y.exports.d)) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
    for (const [code, val] of Object.entries(y.imports.d)) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
  }

  const activeDetailed: [string, number][] = Object.keys(allDetailedTotals).map((code) => [code, Math.round(latestDetailedMap[code] || 0)]);
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
      latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + rec.t;
    }
    for (const [pIso, rec] of Object.entries(latestPartnerYear.imports.partners)) {
      latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + rec.t;
    }
  }

  const allPartnersTotalMap: Record<string, number> = {};
  for (const y of timeline) {
    for (const [pIso, rec] of Object.entries(y.exports.partners)) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + rec.t;
    }
    for (const [pIso, rec] of Object.entries(y.imports.partners)) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + rec.t;
    }
  }

  const activePartners: [string, number][] = Object.keys(allPartnersTotalMap).map((code) => [code, Math.round(latestPartnerMap[code] || 0)]);
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

/**
 * Computes annual USD deflator multipliers normalized to 2021 = 1.0 based on US CPI inflation (pcpipch).
 * Multiplier k_t = CPI_2021 / CPI_t converts nominal current USD of year t into constant 2021 USD.
 */
export function buildUsdDeflator2021(usRawProfile: RawCountryProfile | undefined, minYear = START_YEAR, maxYear = CURRENT_YEAR, baseYear = 2021): Record<number, number> {
  const deflator: Record<number, number> = {};
  const yearsData = usRawProfile?.years || {};

  const k: Record<number, number> = { [baseYear]: 1.0 };

  for (let y = baseYear; y > minYear; y--) {
    const rate = yearsData[String(y)]?.pcpipch;
    k[y - 1] = rate != null ? k[y] * (1 + rate / 100) : k[y];
  }

  for (let y = baseYear + 1; y <= maxYear; y++) {
    const rate = yearsData[String(y)]?.pcpipch;
    k[y] = rate != null ? k[y - 1] / (1 + rate / 100) : k[y - 1];
  }

  for (let y = minYear; y <= maxYear; y++) {
    deflator[y] = round(k[y] ?? 1.0, 4);
  }

  return deflator;
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

  const bilateralIndex = buildBilateralImportIndex(countries);

  const gdpMap: Record<string, number> = {};
  let minYear = CURRENT_YEAR;
  let maxYear = START_YEAR;
  let hasAnyYear = false;

  for (const [code, rawData] of completeCountries) {
    const profile = buildProductionProfile(rawData, countries, bilateralIndex);
    await writeJsonAsyncToSite(`country/${code.toLowerCase()}.json`, profile);

    let latestGdp: number | undefined;
    for (let i = profile.timeline.length - 1; i >= 0; i--) {
      const val = profile.timeline[i].macro.gdpNominalUsd;
      if (val != null) {
        latestGdp = val;
        break;
      }
    }
    const fallback = COUNTRY_BY_CODE.get(code)?.gdp;
    const val = latestGdp ?? (fallback != null ? Math.round(fallback * 1e9) : undefined);
    if (val != null) {
      gdpMap[code] = Math.round(val);
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

  const deflator = buildUsdDeflator2021(countries.us, minYear, maxYear);
  await writeJsonAsyncToSite('country/deflator.json', deflator);
  await writeJsonAsyncToSite('country/toolbar-meta.json', toolbarMeta);
  await updateMetadata('country');

  const exportLogger = getPipelineLogger('country');
  exportLogger.exported(`${countryList.length} complete country profiles, deflator.json, and toolbar-meta.json`);
}

/** Runs the standalone Country ETL Pipeline checking 1990..CURRENT_YEAR dynamically with smart incremental fetching. */
export async function runCountryPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'country',
    async () => {
      const logger = getPipelineLogger('country');
      logger.start('Country');

      await ensurePipelineL1('country');
      const cache = await loadCountryCache();
      const force = forceUpdate || isUpdate();
      if (force) {
        logger.info('Force update requested (-u): resetting cache to re-download all countries from scratch...');
        cache.countries = {};
      }

      const targetYears = range(START_YEAR, CURRENT_YEAR);
      const catalog = await fetchAvailabilityCatalog();

      // 1. Identify which countries have missing streams or updated checksums
      const countriesNeedingUpdate = COUNTRIES.filter((c) => {
        const existing = cache.countries[c.code];
        return force || !isCountryComplete(existing, targetYears, c.id, catalog, existing?.imfLastModified);
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

        const hasChanges = macroChanged || goodsChanged || servicesChanged;

        await flushPendingJsonSaves();
        if (hasChanges) {
          logger.success(`Updated raw Tier 1 cache saved to ${DATA_DIR}`);
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
