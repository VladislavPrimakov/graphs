import type { CountryToolbarMeta } from '@graphs/types/country';
import { type CountryCategoryTuple, type CountryPartnerTuple, type CountryProfileData, EBOPS_SERVICE_CODES, TRADE_CATEGORY_IDS, type TradeCategoryId } from '@graphs/types/country';
import { exportProjectMeta, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchWithRetry, HttpError } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { percentage, range, round } from '@/utils/math';
import { updateMetadata } from '@/utils/metadata';
import { loadEnv } from '@/utils/paths';
import { resolveRegionCode } from '@/utils/region';
import { COUNTRY_CATEGORIES_META, EBOPS_TO_SERVICES_MAP, HS_TO_MACRO_MAP, HS2_CHAPTERS } from './classification';
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_BY_ID, COUNTRY_BY_ISO3, type CountryEntry, SUPPORTED_COUNTRIES } from './countries';

loadEnv();

const DATA_FILE = getPipelineDataPath('country');

export { COUNTRIES, SUPPORTED_COUNTRIES };

export const START_YEAR = 1990;
export const CURRENT_YEAR = new Date().getFullYear() - 1;
export const CHUNK_SIZE = 12;
export const BATCH_SIZE = 5;

const comtradeKey = process.env.COMTRADE_API_KEY || '';
const comtradeHeaders: Record<string, string> = comtradeKey ? { 'Ocp-Apim-Subscription-Key': comtradeKey } : {};

export const REQUIRED_IMF_INDICATORS = [
  'gdpNominalUsd',
  'gdpRealGrowthYoy',
  'gdpPerCapitaUsd',
  'gdpPppUsd',
  'govExpenditurePctGdp',
  'govRevenuePctGdp',
  'govBalancePctGdp',
  'govDebtPctGdp',
  'inflationPct',
  'unemploymentPct',
  'currentAccountPctGdp',
] as const;

export type RequiredMacroKey = (typeof REQUIRED_IMF_INDICATORS)[number];

/** UN Comtrade statistical, accounting, and unspecified non-country area aggregates mapped to Others. */
export const STATISTICAL_PARTNER_CODES = new Set(['_X', 'XX', 'X1', 'X2', 'E19', 'F19', 'O19', 'A79', 'A59', 'F97', 'E29', 'A49', 'F49', 'R91', 'NTZ', '_AC', '_CI', '_SM', '_TK', '_WI', '_ZP']);

export interface RawYearData {
  /** Raw merchandise exports by 2-digit HS chapter in billion USD: { "01": 1.25, ... } or null if no trade reported */
  exports?: Record<string, number> | null;
  /** Raw merchandise imports by 2-digit HS chapter in billion USD or null if no trade reported */
  imports?: Record<string, number> | null;
  /** Raw commercial services exports by 3-digit EBOPS code in billion USD: { "205": 91.0, ... } or null if no trade reported */
  servicesExports?: Record<string, number> | null;
  /** Raw commercial services imports by 3-digit EBOPS code in billion USD or null if no trade reported */
  servicesImports?: Record<string, number> | null;
  /** Complete bilateral exports turnover by partner ISO-3: { "CAN": 352.76, ... } or null if no trade reported */
  partnerExports?: Record<string, number> | null;
  /** Complete bilateral imports turnover by partner ISO-3: { "CHN": 536.8, ... } or null if no trade reported */
  partnerImports?: Record<string, number> | null;
  /** Upstream UN Comtrade HS goods dataset checksum for this reporter and year */
  goodsChecksum?: number | null;
  /** Upstream UN Comtrade EBOPS services dataset checksum for this reporter and year */
  servicesChecksum?: number | null;
}

export interface RawCountryProfile {
  code: string;
  years: Record<string, RawYearData>;
  macro?: Partial<Record<RequiredMacroKey, Record<string, number | null> | null>>;
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
          getLogger('country').warn(`UN Comtrade quota exhausted: ${err.message}`);
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
): { goods: number[]; partners: number[]; services: number[]; needsImf: boolean } {
  const missingGoods: number[] = [];
  const missingPartners: number[] = [];
  const missingServices: number[] = [];

  for (const y of targetYears) {
    const yStr = String(y);
    const yData = existing?.years?.[yStr];

    const upstreamGoodsChecksum = reporterId && catalog ? catalog.goodsChecksums.get(`${reporterId}:${y}`) : undefined;
    const upstreamServicesChecksum = reporterId && catalog ? catalog.servicesChecksums.get(`${reporterId}:${y}`) : undefined;

    const needsGoodsFetch = yData?.exports === undefined || yData?.imports === undefined || (upstreamGoodsChecksum !== undefined && yData.goodsChecksum !== upstreamGoodsChecksum);

    const needsPartnersFetch = yData?.partnerExports === undefined || yData?.partnerImports === undefined || (upstreamGoodsChecksum !== undefined && yData.goodsChecksum !== upstreamGoodsChecksum);

    const needsServicesFetch =
      yData?.servicesExports === undefined || yData?.servicesImports === undefined || (upstreamServicesChecksum !== undefined && yData.servicesChecksum !== upstreamServicesChecksum);

    if (needsGoodsFetch) missingGoods.push(y);
    if (needsPartnersFetch) missingPartners.push(y);
    if (needsServicesFetch) missingServices.push(y);
  }

  const gdpMap = existing?.macro?.gdpNominalUsd;
  const needsImf = !gdpMap;

  return {
    goods: missingGoods,
    partners: missingPartners,
    services: missingServices,
    needsImf,
  };
}

/** Returns true if a country profile is fully populated across all target years and all 4 streams. */
export function isCountryComplete(existing: RawCountryProfile | undefined, targetYears: number[] = range(START_YEAR, CURRENT_YEAR), reporterId?: number, catalog?: AvailabilityCatalog): boolean {
  if (!existing) return false;
  const missing = detectMissingStreams(existing, targetYears, reporterId, catalog);
  return missing.goods.length === 0 && missing.partners.length === 0 && missing.services.length === 0 && !missing.needsImf;
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
    getLogger('country').warn(`Failed to fetch partnerAreas.json: ${err}`);
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
  const logger = getLogger('country');
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
  const logger = getLogger('country');
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

type Ag2Row = { reporterCode: number; period: string; flowCode: string; cmdCode: string; primaryValue: number };
type PartnerRow = { reporterCode: number; period: string; flowCode: string; partnerCode: number; primaryValue: number };
type ServiceRow = { reporterCode: number; period: string; flowCode: string; cmdCode: string; primaryValue: number };

/** Fetches raw country data for a batch of countries (up to 5) via multi-country UN Comtrade queries. */
export async function fetchRawCountryBatch(
  batch: CountryEntry[],
  existingMap: Record<string, RawCountryProfile>,
  partnersMap?: Record<number, string>,
  catalog?: AvailabilityCatalog,
): Promise<Record<string, RawCountryProfile>> {
  const logger = getLogger('country');
  const targetYears = range(START_YEAR, CURRENT_YEAR);

  // 1. Detect missing years per country and across the batch
  const countryMissingMap = new Map<string, ReturnType<typeof detectMissingStreams>>();
  const allMissingGoodsYears = new Set<number>();
  const allMissingPartnerYears = new Set<number>();
  const allMissingServiceYears = new Set<number>();

  for (const c of batch) {
    const existing = existingMap[c.code];
    const missing = detectMissingStreams(existing, targetYears, c.id, catalog);
    countryMissingMap.set(c.code, missing);
    for (const y of missing.goods) allMissingGoodsYears.add(y);
    for (const y of missing.partners) allMissingPartnerYears.add(y);
    for (const y of missing.services) allMissingServiceYears.add(y);
  }

  const goodsChunks = chunkYears(Array.from(allMissingGoodsYears).sort((a, b) => a - b));
  const partnerChunks = chunkYears(Array.from(allMissingPartnerYears).sort((a, b) => a - b));
  const serviceChunks = chunkYears(Array.from(allMissingServiceYears).sort((a, b) => a - b));

  const reporterParam = batch.map((c) => c.id).join(',');
  const batchLabel = batch.map((c) => c.code.toUpperCase()).join(',');

  logger.info(
    `[Batch: ${batchLabel}] Missing: Goods (${allMissingGoodsYears.size} yrs / ${goodsChunks.length} q), Partners (${allMissingPartnerYears.size} yrs / ${partnerChunks.length} q), Services (${allMissingServiceYears.size} yrs / ${serviceChunks.length} q)`,
  );

  // 2. Fetch Goods (cmdCode=AG2, partnerCode=0)
  const newAg2Rows: Ag2Row[] = [];
  const successfulGoodsYears = new Set<number>();
  for (const chunk of goodsChunks) {
    if (comtradeQuotaExhausted) break;
    const periodParam = chunk.join(',');
    const ag2Url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?period=${periodParam}&reporterCode=${reporterParam}&flowCode=X,M&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0&cmdCode=AG2`;
    try {
      const res = await fetchComtradeWithPacer(ag2Url);
      if (res.ok) {
        for (const y of chunk) successfulGoodsYears.add(y);
        const json = (await res.json()) as { data?: Ag2Row[] };
        if (json.data) newAg2Rows.push(...json.data);
      } else {
        logger.warn(`[Batch Comtrade AG2] HTTP ${res.status} (${periodParam}): ${await res.text()}`);
      }
    } catch (err) {
      if (err instanceof HttpError && err.isQuotaExhausted) break;
      logger.warn(`[Batch Comtrade AG2] query failed (${periodParam}): ${err}`);
    }
  }

  // 3. Fetch Partners (cmdCode=TOTAL, all partners)
  const newPartnerRows: PartnerRow[] = [];
  const successfulPartnerYears = new Set<number>();
  if (!comtradeQuotaExhausted) {
    for (const chunk of partnerChunks) {
      if (comtradeQuotaExhausted) break;
      const periodParam = chunk.join(',');
      const partnerUrl = `https://comtradeapi.un.org/data/v1/get/C/A/HS?period=${periodParam}&reporterCode=${reporterParam}&flowCode=X,M&partner2Code=0&customsCode=C00&motCode=0&cmdCode=TOTAL`;
      try {
        const pRes = await fetchComtradeWithPacer(partnerUrl);
        if (pRes.ok) {
          for (const y of chunk) successfulPartnerYears.add(y);
          const pJson = (await pRes.json()) as { data?: PartnerRow[] };
          if (pJson.data) newPartnerRows.push(...pJson.data);
        } else {
          logger.warn(`[Batch Comtrade Partners] HTTP ${pRes.status} (${periodParam}): ${await pRes.text()}`);
        }
      } catch (err) {
        if (err instanceof HttpError && err.isQuotaExhausted) break;
        logger.warn(`[Batch Comtrade Partners] query failed (${periodParam}): ${err}`);
      }
    }
  }

  // 4. Fetch Services (EB02)
  const newServiceRows: ServiceRow[] = [];
  const successfulServiceYears = new Set<number>();
  if (!comtradeQuotaExhausted) {
    for (const chunk of serviceChunks) {
      if (comtradeQuotaExhausted) break;
      const periodParam = chunk.join(',');
      const ebopsCodesParam = EBOPS_SERVICE_CODES.join(',');
      const serviceUrl = `https://comtradeapi.un.org/data/v1/get/S/A/EB?period=${periodParam}&reporterCode=${reporterParam}&flowCode=X,M&partnerCode=0&cmdCode=${ebopsCodesParam}`;
      try {
        const sRes = await fetchComtradeWithPacer(serviceUrl);
        if (sRes.ok) {
          for (const y of chunk) successfulServiceYears.add(y);
          const sJson = (await sRes.json()) as { data?: ServiceRow[] };
          if (sJson.data) newServiceRows.push(...sJson.data);
        } else {
          logger.warn(`[Batch Comtrade Services] HTTP ${sRes.status} (${periodParam}): ${await sRes.text()}`);
        }
      } catch (err) {
        if (err instanceof HttpError && err.isQuotaExhausted) break;
        logger.warn(`[Batch Comtrade Services] query failed (${periodParam}): ${err}`);
      }
    }
  }

  // 5. Ingest results per country in the batch
  const resultMap: Record<string, RawCountryProfile> = {};

  for (const country of batch) {
    const existing = existingMap[country.code];
    const missing = countryMissingMap.get(country.code);
    if (!missing) continue;

    const countryAg2 = newAg2Rows.filter((r) => r.reporterCode === country.id);
    const countryPartners = newPartnerRows.filter((r) => r.reporterCode === country.id);
    const countryServices = newServiceRows.filter((r) => r.reporterCode === country.id);

    const imfIndicators = missing.needsImf && !comtradeQuotaExhausted ? await fetchImfIndicators(country.iso3) : {};

    // If quota was exhausted and nothing was fetched for this country, preserve existing
    if (comtradeQuotaExhausted && countryAg2.length === 0 && countryPartners.length === 0 && countryServices.length === 0) {
      if (existing) resultMap[country.code] = existing;
      continue;
    }

    const updatedYears: Record<string, RawYearData> = { ...(existing?.years || {}) };

    // Initialize queried years only if upstream request was successful: default to null (confirmed no trade reported)
    for (const y of missing.goods) {
      if (!successfulGoodsYears.has(y)) continue;
      const yStr = String(y);
      if (!updatedYears[yStr]) updatedYears[yStr] = {};
      if (updatedYears[yStr].exports === undefined) updatedYears[yStr].exports = null;
      if (updatedYears[yStr].imports === undefined) updatedYears[yStr].imports = null;
    }
    for (const y of missing.partners) {
      if (!successfulPartnerYears.has(y)) continue;
      const yStr = String(y);
      if (!updatedYears[yStr]) updatedYears[yStr] = {};
      if (updatedYears[yStr].partnerExports === undefined) updatedYears[yStr].partnerExports = null;
      if (updatedYears[yStr].partnerImports === undefined) updatedYears[yStr].partnerImports = null;
    }
    for (const y of missing.services) {
      if (!successfulServiceYears.has(y)) continue;
      const yStr = String(y);
      if (!updatedYears[yStr]) updatedYears[yStr] = {};
      if (updatedYears[yStr].servicesExports === undefined) updatedYears[yStr].servicesExports = null;
      if (updatedYears[yStr].servicesImports === undefined) updatedYears[yStr].servicesImports = null;
    }

    // Ingest AG2
    for (const r of countryAg2) {
      const valB = round(r.primaryValue / 1e9, 3);
      if (valB <= 0) continue;

      const yStr = r.period;
      let yData = updatedYears[yStr];
      if (!yData) {
        yData = {};
        updatedYears[yStr] = yData;
      }

      const ch = r.cmdCode.padStart(2, '0');
      if (r.flowCode === 'X') {
        if (!yData.exports) yData.exports = {};
        yData.exports[ch] = valB;
      } else if (r.flowCode === 'M') {
        if (!yData.imports) yData.imports = {};
        yData.imports[ch] = valB;
      }
    }

    // Ingest Services (keep strictly valid 11 EBOPS categories with non-zero volume)
    const validEbops = new Set<string>(EBOPS_SERVICE_CODES);
    for (const r of countryServices) {
      if (!validEbops.has(r.cmdCode)) continue;
      const valB = round(r.primaryValue / 1e9, 3);
      if (valB <= 0) continue;

      const yStr = r.period;
      let yData = updatedYears[yStr];
      if (!yData) {
        yData = {};
        updatedYears[yStr] = yData;
      }

      const code = r.cmdCode;
      if (r.flowCode === 'X') {
        if (!yData.servicesExports) yData.servicesExports = {};
        yData.servicesExports[code] = valB;
      } else if (r.flowCode === 'M') {
        if (!yData.servicesImports) yData.servicesImports = {};
        yData.servicesImports[code] = valB;
      }
    }

    // Ingest Partners (ignore world total and negligible or zero volumes)
    for (const r of countryPartners) {
      if (r.partnerCode === 0) continue;
      const valB = round(r.primaryValue / 1e9, 3);
      if (valB <= 0) continue;

      const yStr = r.period;
      let yData = updatedYears[yStr];
      if (!yData) {
        yData = {};
        updatedYears[yStr] = yData;
      }

      const partnerCountry = COUNTRY_BY_ID.get(r.partnerCode);
      let pCode = partnerCountry ? partnerCountry.code.toUpperCase() : resolveRegionCode(partnersMap?.[r.partnerCode] || String(r.partnerCode));
      if (STATISTICAL_PARTNER_CODES.has(pCode.toUpperCase()) || pCode.startsWith('_')) {
        pCode = 'Others';
      }
      if (r.flowCode === 'X') {
        if (!yData.partnerExports) yData.partnerExports = {};
        yData.partnerExports[pCode] = round((yData.partnerExports[pCode] || 0) + valB, 3);
      } else if (r.flowCode === 'M') {
        if (!yData.partnerImports) yData.partnerImports = {};
        yData.partnerImports[pCode] = round((yData.partnerImports[pCode] || 0) + valB, 3);
      }
    }

    // Merge IMF indicators
    const updatedMacro: Record<RequiredMacroKey, Record<string, number | null>> = {
      gdpNominalUsd: { ...(existing?.macro?.gdpNominalUsd || {}), ...(imfIndicators.NGDPD || {}) },
      gdpRealGrowthYoy: { ...(existing?.macro?.gdpRealGrowthYoy || {}), ...(imfIndicators.NGDP_RPCH || {}) },
      gdpPerCapitaUsd: { ...(existing?.macro?.gdpPerCapitaUsd || {}), ...(imfIndicators.NGDPDPC || {}) },
      gdpPppUsd: { ...(existing?.macro?.gdpPppUsd || {}), ...(imfIndicators.PPPGDP || {}) },
      govExpenditurePctGdp: { ...(existing?.macro?.govExpenditurePctGdp || {}), ...(imfIndicators.G_X_G01_GDP_PT || {}) },
      govRevenuePctGdp: { ...(existing?.macro?.govRevenuePctGdp || {}), ...(imfIndicators.GGR_G01_GDP_PT || {}) },
      govBalancePctGdp: { ...(existing?.macro?.govBalancePctGdp || {}), ...(imfIndicators.GGXCNL_NGDP || {}) },
      govDebtPctGdp: { ...(existing?.macro?.govDebtPctGdp || {}), ...(imfIndicators.GGXWDG_NGDP || {}) },
      inflationPct: { ...(existing?.macro?.inflationPct || {}), ...(imfIndicators.PCPIPCH || {}) },
      unemploymentPct: { ...(existing?.macro?.unemploymentPct || {}), ...(imfIndicators.LUR || {}) },
      currentAccountPctGdp: { ...(existing?.macro?.currentAccountPctGdp || {}), ...(imfIndicators.BCA_NGDPD || {}) },
    };

    if (catalog && country.id) {
      for (const y of targetYears) {
        const yStr = String(y);
        const yData = updatedYears[yStr];
        if (yData) {
          const upstreamGoods = catalog.goodsChecksums.get(`${country.id}:${y}`);
          if (upstreamGoods !== undefined) {
            yData.goodsChecksum = upstreamGoods;
          }
          const upstreamServices = catalog.servicesChecksums.get(`${country.id}:${y}`);
          if (upstreamServices !== undefined) {
            yData.servicesChecksum = upstreamServices;
          }
        }
      }
    }

    resultMap[country.code] = {
      code: country.code,
      years: updatedYears,
      macro: updatedMacro,
    };
  }

  return resultMap;
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
  const resultMap = await fetchRawCountryBatch([meta], existing ? { [meta.code]: existing } : {}, partnersMap, catalog);
  return resultMap[meta.code] || existing || null;
}

/** Loads existing Tier 1 raw country cache snapshot from data.json. */
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

/** Converts raw country cache into a fully aggregated and formatted Tier 2 production dataset. */
export function buildProductionProfile(raw: RawCountryProfile): CountryProfileData {
  const years = Object.keys(raw.years || {})
    .map(Number)
    .filter((y) => {
      const yStr = String(y);
      const yData = raw.years[yStr];
      const hasGoods = (yData?.exports && Object.keys(yData.exports).length > 0) || (yData?.imports && Object.keys(yData.imports).length > 0);
      const hasServ = (yData?.servicesExports && Object.keys(yData.servicesExports).length > 0) || (yData?.servicesImports && Object.keys(yData.servicesImports).length > 0);
      const hasGdp = raw.macro?.gdpNominalUsd?.[yStr] != null;
      return hasGoods || hasServ || hasGdp;
    })
    .sort((a, b) => a - b);

  // Trade totals
  const goodsExportsUsd: (number | null)[] = [];
  const goodsImportsUsd: (number | null)[] = [];
  const goodsBalanceUsd: (number | null)[] = [];

  const servicesExportsUsd: (number | null)[] = [];
  const servicesImportsUsd: (number | null)[] = [];
  const servicesBalanceUsd: (number | null)[] = [];

  const totalExportsUsd: (number | null)[] = [];
  const totalImportsUsd: (number | null)[] = [];
  const netBalanceUsd: (number | null)[] = [];

  // Macro categories: 10 goods + 7 services
  const macroExports: CountryCategoryTuple[][] = [];
  const macroImports: CountryCategoryTuple[][] = [];

  // Detailed categories: 97 HS chapters + 11 EBOPS services codes
  const detailedExports: CountryCategoryTuple[][] = [];
  const detailedImports: CountryCategoryTuple[][] = [];

  const partnerExports: CountryPartnerTuple[][] = [];
  const partnerImports: CountryPartnerTuple[][] = [];

  for (let i = 0; i < years.length; i++) {
    const yStr = String(years[i]);
    const yData = raw.years[yStr];
    if (!yData) {
      goodsExportsUsd.push(null);
      goodsImportsUsd.push(null);
      goodsBalanceUsd.push(null);
      servicesExportsUsd.push(null);
      servicesImportsUsd.push(null);
      servicesBalanceUsd.push(null);
      totalExportsUsd.push(null);
      totalImportsUsd.push(null);
      netBalanceUsd.push(null);
      macroExports.push([]);
      macroImports.push([]);
      detailedExports.push([]);
      detailedImports.push([]);
      partnerExports.push([]);
      partnerImports.push([]);
      continue;
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

    for (const ch of HS2_CHAPTERS) {
      const code = ch.code;
      const xVal = yData.exports?.[code] ?? null;
      const mVal = yData.imports?.[code] ?? null;

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
    let yearServM = 0;
    let hasServX = false;
    let hasServM = false;

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
    goodsExportsUsd.push(gX);
    goodsImportsUsd.push(gM);
    goodsBalanceUsd.push(gX != null && gM != null ? round(gX - gM, 3) : null);

    const sX = hasServX ? round(yearServX, 3) : null;
    const sM = hasServM ? round(yearServM, 3) : null;
    servicesExportsUsd.push(sX);
    servicesImportsUsd.push(sM);
    servicesBalanceUsd.push(sX != null && sM != null ? round(sX - sM, 3) : null);

    // Combined Totals (Goods + Services)
    const totX = round((gX || 0) + (sX || 0), 3);
    const totM = round((gM || 0) + (sM || 0), 3);
    totalExportsUsd.push(totX > 0 ? totX : gX);
    totalImportsUsd.push(totM > 0 ? totM : gM);
    netBalanceUsd.push(totX > 0 && totM > 0 ? round(totX - totM, 3) : null);

    // Macro categories tuples sorted by volume descending
    const catMacroXTuples: CountryCategoryTuple[] = [];
    for (const id of TRADE_CATEGORY_IDS) {
      const val = yearMacroX[id];
      if (val > 0) {
        catMacroXTuples.push([id, round(val, 2), percentage(val, totX > 0 ? totX : 1, 1)]);
      }
    }
    catMacroXTuples.sort((a, b) => b[1] - a[1]);
    macroExports.push(catMacroXTuples);

    const catMacroMTuples: CountryCategoryTuple[] = [];
    for (const id of TRADE_CATEGORY_IDS) {
      const val = yearMacroM[id];
      if (val > 0) {
        catMacroMTuples.push([id, round(val, 2), percentage(val, totM > 0 ? totM : 1, 1)]);
      }
    }
    catMacroMTuples.sort((a, b) => b[1] - a[1]);
    macroImports.push(catMacroMTuples);

    // Detailed categories tuples sorted by volume descending
    const catDetXTuples: CountryCategoryTuple[] = [];
    for (const ch of HS2_CHAPTERS) {
      const val = yData.exports?.[ch.code];
      if (val != null && val > 0) {
        catDetXTuples.push([ch.code, round(val, 2), percentage(val, totX > 0 ? totX : 1, 1)]);
      }
    }
    for (const eb of EBOPS_SERVICE_CODES) {
      const val = yData.servicesExports?.[eb];
      if (val != null && val > 0) {
        catDetXTuples.push([eb, round(val, 2), percentage(val, totX > 0 ? totX : 1, 1)]);
      }
    }
    catDetXTuples.sort((a, b) => b[1] - a[1]);
    detailedExports.push(catDetXTuples);

    const catDetMTuples: CountryCategoryTuple[] = [];
    for (const ch of HS2_CHAPTERS) {
      const val = yData.imports?.[ch.code];
      if (val != null && val > 0) {
        catDetMTuples.push([ch.code, round(val, 2), percentage(val, totM > 0 ? totM : 1, 1)]);
      }
    }
    for (const eb of EBOPS_SERVICE_CODES) {
      const val = yData.servicesImports?.[eb];
      if (val != null && val > 0) {
        catDetMTuples.push([eb, round(val, 2), percentage(val, totM > 0 ? totM : 1, 1)]);
      }
    }
    catDetMTuples.sort((a, b) => b[1] - a[1]);
    detailedImports.push(catDetMTuples);

    // 3. Export ALL partner countries (excluding zero values), sorted by volume descending
    const pX = Object.entries(yData.partnerExports || {}).filter(([, val]) => val > 0);
    const pXTot = pX.reduce((acc, [, val]) => acc + val, 0);
    const sortedPX = pX.sort((a, b) => b[1] - a[1]).map(([pIso, val]) => [pIso, round(val, 2), percentage(val, pXTot, 1)] as CountryPartnerTuple);
    partnerExports.push(sortedPX);

    const pM = Object.entries(yData.partnerImports || {}).filter(([, val]) => val > 0);
    const pMTot = pM.reduce((acc, [, val]) => acc + val, 0);
    const sortedPM = pM.sort((a, b) => b[1] - a[1]).map(([pIso, val]) => [pIso, round(val, 2), percentage(val, pMTot, 1)] as CountryPartnerTuple);
    partnerImports.push(sortedPM);
  }

  // 4. Map and calculate comprehensive IMF macroeconomic indicators
  const getMacroVal = (key: RequiredMacroKey, y: number): number | null => {
    const map = raw.macro?.[key];
    if (!map) return null;
    const val = map[String(y)];
    return typeof val === 'number' ? val : null;
  };

  const gdpNominalUsd = years.map((y) => {
    const val = getMacroVal('gdpNominalUsd', y);
    return val != null ? round(val, 2) : null;
  });
  const gdpRealGrowthYoy = years.map((y) => {
    const val = getMacroVal('gdpRealGrowthYoy', y);
    return val != null ? round(val, 2) : null;
  });
  const gdpPerCapitaUsd = years.map((y) => {
    const val = getMacroVal('gdpPerCapitaUsd', y);
    return val != null ? round(val, 1) : null;
  });
  const gdpPppUsd = years.map((y) => {
    const val = getMacroVal('gdpPppUsd', y);
    return val != null ? round(val, 2) : null;
  });

  // Government budget (% of GDP and billion USD)
  const govExpenditurePctGdp = years.map((y) => {
    const val = getMacroVal('govExpenditurePctGdp', y);
    return val != null ? round(val, 2) : null;
  });
  const govRevenuePctGdp = years.map((y) => {
    const val = getMacroVal('govRevenuePctGdp', y);
    return val != null ? round(val, 2) : null;
  });
  const govBalancePctGdp = years.map((y) => {
    const val = getMacroVal('govBalancePctGdp', y);
    return val != null ? round(val, 2) : null;
  });
  const govDebtPctGdp = years.map((y) => {
    const val = getMacroVal('govDebtPctGdp', y);
    return val != null ? round(val, 1) : null;
  });

  const govExpenditureUsd = years.map((_, i) => (gdpNominalUsd[i] != null && govExpenditurePctGdp[i] != null ? round((gdpNominalUsd[i]! * govExpenditurePctGdp[i]!) / 100, 2) : null));
  const govRevenueUsd = years.map((_, i) => (gdpNominalUsd[i] != null && govRevenuePctGdp[i] != null ? round((gdpNominalUsd[i]! * govRevenuePctGdp[i]!) / 100, 2) : null));
  const govBalanceUsd = years.map((_, i) => (gdpNominalUsd[i] != null && govBalancePctGdp[i] != null ? round((gdpNominalUsd[i]! * govBalancePctGdp[i]!) / 100, 2) : null));
  const govDebtUsd = years.map((_, i) => (gdpNominalUsd[i] != null && govDebtPctGdp[i] != null ? round((gdpNominalUsd[i]! * govDebtPctGdp[i]!) / 100, 2) : null));

  const inflationPct = years.map((y) => {
    const val = getMacroVal('inflationPct', y);
    return val != null ? round(val, 2) : null;
  });
  const unemploymentPct = years.map((y) => {
    const val = getMacroVal('unemploymentPct', y);
    return val != null ? round(val, 2) : null;
  });
  const currentAccountPctGdp = years.map((y) => {
    const val = getMacroVal('currentAccountPctGdp', y);
    return val != null ? round(val, 2) : null;
  });
  const currentAccountUsd = years.map((_, i) => (gdpNominalUsd[i] != null && currentAccountPctGdp[i] != null ? round((gdpNominalUsd[i]! * currentAccountPctGdp[i]!) / 100, 2) : null));

  // 5. YoY Growth Dynamics
  const gdpYoy: (number | null)[] = [null];
  const gdpDiffUsd: (number | null)[] = [null];
  const revenueYoy: (number | null)[] = [null];
  const revenueDiffUsd: (number | null)[] = [null];
  const expenditureYoy: (number | null)[] = [null];
  const expenditureDiffUsd: (number | null)[] = [null];
  const debtYoy: (number | null)[] = [null];
  const debtDiffUsd: (number | null)[] = [null];

  for (let i = 1; i < years.length; i++) {
    const calcYoy = (c: number | null, p: number | null) => (c == null || p == null || p === 0 ? null : round(((c - p) / Math.abs(p)) * 100, 1));
    const calcDiff = (c: number | null, p: number | null) => (c == null || p == null ? null : round(c - p, 2));

    gdpYoy.push(calcYoy(gdpNominalUsd[i], gdpNominalUsd[i - 1]));
    gdpDiffUsd.push(calcDiff(gdpNominalUsd[i], gdpNominalUsd[i - 1]));
    revenueYoy.push(calcYoy(govRevenueUsd[i], govRevenueUsd[i - 1]));
    revenueDiffUsd.push(calcDiff(govRevenueUsd[i], govRevenueUsd[i - 1]));
    expenditureYoy.push(calcYoy(govExpenditureUsd[i], govExpenditureUsd[i - 1]));
    expenditureDiffUsd.push(calcDiff(govExpenditureUsd[i], govExpenditureUsd[i - 1]));
    debtYoy.push(calcYoy(govDebtUsd[i], govDebtUsd[i - 1]));
    debtDiffUsd.push(calcDiff(govDebtUsd[i], govDebtUsd[i - 1]));
  }

  // 6. Precompute sorted rankings for interactive toolbar selectors
  let latestTradeIdx = years.length - 1;
  while (latestTradeIdx >= 0) {
    const x = totalExportsUsd[latestTradeIdx];
    const m = totalImportsUsd[latestTradeIdx];
    if ((x != null && x > 0) || (m != null && m > 0)) break;
    latestTradeIdx--;
  }
  if (latestTradeIdx < 0) latestTradeIdx = years.length - 1;

  const allMacroTotals: Record<string, number> = {};
  const latestMacroMap: Record<string, number> = {};
  for (const [id, val] of macroExports[latestTradeIdx] || []) {
    latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
  }
  for (const [id, val] of macroImports[latestTradeIdx] || []) {
    latestMacroMap[id] = (latestMacroMap[id] || 0) + val;
  }
  for (let i = 0; i < macroExports.length; i++) {
    for (const [id, val] of macroExports[i] || []) {
      allMacroTotals[id] = (allMacroTotals[id] || 0) + val;
    }
    for (const [id, val] of macroImports[i] || []) {
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
  for (const [code, val] of detailedExports[latestTradeIdx] || []) {
    latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
  }
  for (const [code, val] of detailedImports[latestTradeIdx] || []) {
    latestDetailedMap[code] = (latestDetailedMap[code] || 0) + val;
  }
  for (let i = 0; i < detailedExports.length; i++) {
    for (const [code, val] of detailedExports[i] || []) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
    for (const [code, val] of detailedImports[i] || []) {
      allDetailedTotals[code] = (allDetailedTotals[code] || 0) + val;
    }
  }

  const activeDetailed: [string, number][] = Object.keys(allDetailedTotals).map((code) => [code, round(latestDetailedMap[code] || 0, 1)]);
  activeDetailed.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allDetailedTotals[b[0]] || 0) - (allDetailedTotals[a[0]] || 0);
  });

  let latestPartnerIdx = partnerExports.length - 1;
  while (latestPartnerIdx >= 0) {
    const pX = partnerExports[latestPartnerIdx] || [];
    const pM = partnerImports[latestPartnerIdx] || [];
    if (pX.length > 0 || pM.length > 0) break;
    latestPartnerIdx--;
  }
  if (latestPartnerIdx < 0) latestPartnerIdx = 0;

  const latestPartnerMap: Record<string, number> = {};
  for (const [pIso, val] of partnerExports[latestPartnerIdx] || []) {
    latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + val;
  }
  for (const [pIso, val] of partnerImports[latestPartnerIdx] || []) {
    latestPartnerMap[pIso] = (latestPartnerMap[pIso] || 0) + val;
  }

  const allPartnersTotalMap: Record<string, number> = {};
  for (let i = 0; i < partnerExports.length; i++) {
    for (const [pIso, val] of partnerExports[i] || []) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + val;
    }
    for (const [pIso, val] of partnerImports[i] || []) {
      allPartnersTotalMap[pIso] = (allPartnersTotalMap[pIso] || 0) + val;
    }
  }

  const topPartners: [string, number][] = Object.keys(allPartnersTotalMap).map((code) => [code, round(latestPartnerMap[code] || 0, 1)]);
  topPartners.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return (allPartnersTotalMap[b[0]] || 0) - (allPartnersTotalMap[a[0]] || 0);
  });

  return {
    code: raw.code,
    years,
    trade: {
      goodsExportsUsd,
      goodsImportsUsd,
      goodsBalanceUsd,
      servicesExportsUsd,
      servicesImportsUsd,
      servicesBalanceUsd,
      totalExportsUsd,
      totalImportsUsd,
      netBalanceUsd,
    },
    categories: {
      macro: {
        exports: macroExports,
        imports: macroImports,
      },
      detailed: {
        exports: detailedExports,
        imports: detailedImports,
      },
      activeMacro,
      activeDetailed,
    },
    partners: {
      exports: partnerExports,
      imports: partnerImports,
      topPartners,
    },
    macro: {
      gdpNominalUsd,
      gdpRealGrowthYoy,
      gdpPerCapitaUsd,
      gdpPppUsd,
      govExpenditurePctGdp,
      govExpenditureUsd,
      govRevenuePctGdp,
      govRevenueUsd,
      govBalancePctGdp,
      govBalanceUsd,
      govDebtPctGdp,
      govDebtUsd,
      inflationPct,
      unemploymentPct,
      currentAccountPctGdp,
      currentAccountUsd,
      growth: {
        gdpYoy,
        gdpDiffUsd,
        revenueYoy,
        revenueDiffUsd,
        expenditureYoy,
        expenditureDiffUsd,
        debtYoy,
        debtDiffUsd,
      },
    },
  };
}

/** Exports all individual country datasets and toolbar metadata to site/public/data/country. */
export async function exportCountryDatasets(countries: Record<string, RawCountryProfile>): Promise<void> {
  const logger = getLogger('country');
  const countryRank = new Map(SUPPORTED_COUNTRIES.map((code, idx) => [code, idx]));

  // Filter only countries that have both trade years data and macro indicators
  const completeCountries = Object.entries(countries).filter(([_, rawData]) => {
    const yearsCount = Object.keys(rawData.years || {}).length;
    const hasMacro = rawData.macro?.gdpNominalUsd != null && Object.keys(rawData.macro.gdpNominalUsd).length > 0;
    return yearsCount > 0 && hasMacro;
  });

  const countryList: string[] = completeCountries.map(([code]) => code).sort((a, b) => (countryRank.get(a) ?? 999) - (countryRank.get(b) ?? 999));

  const gdpMap: Record<string, number> = {};
  for (const [code, rawData] of completeCountries) {
    const profile = buildProductionProfile(rawData);
    await exportProjectMeta('country', profile, `${code.toLowerCase()}.json`);

    const macroGdp = rawData.macro?.gdpNominalUsd;
    let latestGdp: number | undefined;
    if (macroGdp) {
      const years = Object.keys(macroGdp)
        .map(Number)
        .sort((a, b) => b - a);
      for (const y of years) {
        const val = macroGdp[String(y)];
        if (typeof val === 'number') {
          latestGdp = val;
          break;
        }
      }
    }
    const val = latestGdp ?? COUNTRY_BY_CODE.get(code)?.gdp;
    if (val != null) {
      gdpMap[code] = round(val, 1);
    }
  }

  const yearsWithData: number[] = [];
  for (const [_, rawData] of completeCountries) {
    for (const [yStr, yData] of Object.entries(rawData.years || {})) {
      const hasGoods = (yData?.exports && Object.keys(yData.exports).length > 0) || (yData?.imports && Object.keys(yData.imports).length > 0);
      const hasServ = (yData?.servicesExports && Object.keys(yData.servicesExports).length > 0) || (yData?.servicesImports && Object.keys(yData.servicesImports).length > 0);
      if (hasGoods || hasServ) {
        yearsWithData.push(Number(yStr));
      }
    }
  }
  const minYear = yearsWithData.length > 0 ? Math.min(...yearsWithData) : START_YEAR;
  const maxYear = yearsWithData.length > 0 ? Math.max(...yearsWithData) : CURRENT_YEAR - 1;
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
  await exportProjectMeta('country', toolbarMeta, 'index.json');
  await updateMetadata('country');

  logger.info(`Exported ${countryList.length} complete country profiles and toolbar-meta.json`);
}

/** Runs the standalone Country ETL Pipeline checking 1990..CURRENT_YEAR dynamically with smart incremental fetching. */
export async function runCountryPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'country',
    async () => {
      const logger = getLogger('country');
      logger.start('Starting Country ETL pipeline');

      const cache = await loadCountryCache();
      const force = forceUpdate || isUpdate();
      if (force) {
        logger.info('Force update requested (-u): resetting data.json cache...');
        cache.countries = {};
        delete cache.meta;
      }

      const targetYears = range(START_YEAR, CURRENT_YEAR);
      const catalog = await fetchAvailabilityCatalog();

      const anyCountryNeedsUpdate = COUNTRIES.some((country) => {
        const existing = cache.countries[country.code];
        return !isCountryComplete(existing, targetYears, country.id, catalog);
      });

      const shouldUpdate = force || anyCountryNeedsUpdate;
      let hasChanges = false;

      if (shouldUpdate) {
        logger.info(`Checking upstream UN Comtrade and IMF DataMapper from ${START_YEAR} to ${CURRENT_YEAR}...`);
        const partnersMap = await getPartnerAreasMap();

        // 1. Identify which countries have missing streams
        const countriesNeedingUpdate = COUNTRIES.filter((c) => {
          const existing = cache.countries[c.code];
          return force || !isCountryComplete(existing, targetYears, c.id, catalog);
        });

        logger.info(`Found ${countriesNeedingUpdate.length} countries needing update. Batching by ${BATCH_SIZE}...`);

        // 2. Batch countries by 15
        const batches = chunkArray(countriesNeedingUpdate, BATCH_SIZE);

        for (let bIdx = 0; bIdx < batches.length; bIdx++) {
          if (isComtradeQuotaExhausted()) {
            logger.warn('Comtrade call volume quota exhausted. Halting remaining country online fetches; using existing cached data.');
            break;
          }

          const batch = batches[bIdx];
          const batchCodes = batch.map((c) => c.code.toUpperCase()).join(', ');
          logger.info(`[Batch ${bIdx + 1}/${batches.length}] Fetching ${batch.length} countries: ${batchCodes}`);

          try {
            const updatedMap = await fetchRawCountryBatch(batch, cache.countries, partnersMap, catalog);
            let batchHasChanges = false;
            for (const [code, profile] of Object.entries(updatedMap)) {
              if (profile && profile !== cache.countries[code]) {
                cache.countries[code] = profile;
                hasChanges = true;
                batchHasChanges = true;
              }
            }
            if (batchHasChanges) {
              await writeJson(DATA_FILE, cache, 0);
            }
          } catch (err) {
            logger.warn(`Batch ${bIdx + 1} failed: ${err}`);
          }
        }

        if (catalog.imfLastModified) {
          cache.meta = {
            imfLastModified: catalog.imfLastModified,
            lastUpdated: new Date().toISOString(),
          };
          hasChanges = true;
        }

        if (hasChanges) {
          await writeJson(DATA_FILE, cache, 0);
          logger.success(`Updated minified raw cache saved to ${DATA_FILE}`);
        }
      }

      if (Object.keys(cache.countries).length === 0) {
        logger.warn('No country profiles found in cache! Run with -u to populate.');
        return;
      }

      await exportCountryDatasets(cache.countries);
      logger.success(`Country pipeline complete: ${Object.keys(cache.countries).length} countries ready.`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runCountryPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('country').error('Fatal Country pipeline error:', err);
    process.exit(1);
  });
}
