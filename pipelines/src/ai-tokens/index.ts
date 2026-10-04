import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_COMPANY_IDS, type AiCompanyId, type AiTokensDataset, type CompanySeriesItem, type RegionSeriesItem } from '@graphs/types';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const CACHE_VIEWS_FILE = path.join(CACHE_DIR, 'tokensperday_views.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/ai-tokens.json');

const URL_HOME = 'https://tokensperday.com';

interface RawPoint {
  t: number;
  v: number;
  real?: boolean;
}

interface RawSeries {
  name: string;
  color?: string;
  estimated?: boolean;
  pts: RawPoint[];
}

interface RawViews {
  total: RawSeries[];
  country: RawSeries[];
  company: RawSeries[];
}

/** Extracts embedded time-series views JSON from the tokensperday homepage HTML. */
function extractViews(html: string): RawViews {
  const match = html.match(/const views = (\{[\s\S]*?\});\s*(?:const|let|var|function)/);
  if (!match) {
    throw new Error('Failed to find const views JSON object in tokensperday.com');
  }
  return JSON.parse(match[1]) as RawViews;
}

/**
 * Loads time-series views from tokensperday.com.
 * Always attempts to fetch live upstream data first on every run.
 * Uses local disk cache strictly as a fallback if the network request fails or when offline.
 */
async function loadViews(): Promise<RawViews> {
  const logger = getLogger('ai-tokens');

  try {
    logger.info(`Fetching latest data from ${URL_HOME}`);
    const res = await fetchWithRetry(URL_HOME, { retries: 3, timeoutMs: 25000 });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const views = extractViews(html);
    await writeJson(CACHE_VIEWS_FILE, views, 2);
    logger.debug(`Cached ${path.basename(CACHE_VIEWS_FILE)}`);
    return views;
  } catch (err) {
    if (await fileExists(CACHE_VIEWS_FILE)) {
      logger.warn(`Network fetch failed (${err instanceof Error ? err.message : String(err)}), falling back to disk cache`);
      return readJson<RawViews>(CACHE_VIEWS_FILE);
    }
    throw new Error(`Failed to fetch ${URL_HOME} and no disk cache available: ${err}`);
  }
}

/** Rounds a numeric value to a specified fraction of decimal places. */
function roundNum(val: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

/** Resolves the latest known throughput value for a given series up to the specified date. */
function getLatestValue(pts: RawPoint[], targetTs: number): number {
  let latest = 0;
  for (const p of pts) {
    if (p.t <= targetTs + 86400000 * 5) {
      latest = p.v;
    }
  }
  return latest;
}

/** Runs the AI Tokens ETL Pipeline. Scrapes tokensperday.com, reconciles regional & company metrics, and exports site/src/data/ai-tokens.json. */
export async function runAiTokensPipeline(_forceUpdate = false, verbose?: boolean): Promise<AiTokensDataset> {
  return runWithLogger(
    'ai-tokens',
    async () => {
      const logger = getLogger();
      logger.start('Starting AI Tokens ETL pipeline');

      const views = await loadViews();

      // Generate 30 monthly steps from 2024-01 to 2026-06
      const months: string[] = [];
      const current = new Date('2024-01-15T00:00:00Z');
      const maxDate = new Date('2026-06-15T00:00:00Z');
      while (current <= maxDate) {
        months.push(current.toISOString().slice(0, 7));
        current.setUTCMonth(current.getUTCMonth() + 1);
      }

      // Find regional series by canonical codes
      const findCountry = (pattern: RegExp) => views.country.find((c) => pattern.test(c.name))?.pts ?? [];
      const REGION_DEFS = [
        { code: 'CN', pattern: /China/i },
        { code: 'US', pattern: /United States/i },
        { code: 'EU', pattern: /Europe/i },
        { code: 'AEC', pattern: /Asia/i },
        { code: 'ROW', pattern: /Rest/i },
      ];

      const regionRaw = REGION_DEFS.map(({ code, pattern }) => ({
        code,
        pts: findCountry(pattern),
        values: [] as number[],
        shares: [] as number[],
      }));

      const totalValues: number[] = [];

      for (const m of months) {
        const targetTs = new Date(`${m}-15T00:00:00Z`).getTime();
        let monthTotal = 0;

        for (const r of regionRaw) {
          const val = roundNum(getLatestValue(r.pts, targetTs), 2);
          r.values.push(val);
          monthTotal += val;
        }

        monthTotal = roundNum(monthTotal, 2);
        totalValues.push(monthTotal);

        for (const r of regionRaw) {
          const currentVal = r.values[r.values.length - 1];
          const share = monthTotal > 0 ? roundNum((currentVal / monthTotal) * 100, 1) : 0;
          r.shares.push(share);
        }
      }

      const regionSeries: RegionSeriesItem[] = regionRaw.map(({ code, values, shares }) => ({
        code,
        values,
        shares,
      }));

      // Company mapping
      const COMPANY_MAP: Record<AiCompanyId, RegExp> = {
        doubao: /Doubao/i,
        google: /Google/i,
        openai: /OpenAI/i,
        anthropic: /Anthropic/i,
        fireworks: /Fireworks/i,
        microsoft: /Microsoft/i,
        deepseek: /DeepSeek/i,
        together: /Together/i,
      };

      const companyValues = {} as Record<AiCompanyId, number[]>;
      const companyShares = {} as Record<AiCompanyId, number[]>;
      const companyTotals: number[] = [];

      for (const id of AI_COMPANY_IDS) {
        companyValues[id] = [];
        companyShares[id] = [];
      }

      for (const m of months) {
        const targetTs = new Date(`${m}-15T00:00:00Z`).getTime();
        let monthCompanyTotal = 0;

        for (const id of AI_COMPANY_IDS) {
          const pattern = COMPANY_MAP[id];
          const pts = views.company.find((s) => pattern.test(s.name))?.pts ?? [];
          const val = roundNum(getLatestValue(pts, targetTs), 1);
          companyValues[id].push(val);
          monthCompanyTotal += val;
        }

        monthCompanyTotal = roundNum(monthCompanyTotal, 1);
        companyTotals.push(monthCompanyTotal);

        for (const id of AI_COMPANY_IDS) {
          const val = companyValues[id][companyValues[id].length - 1];
          const share = monthCompanyTotal > 0 ? roundNum((val / monthCompanyTotal) * 100, 1) : 0;
          companyShares[id].push(share);
        }
      }

      const companySeries: CompanySeriesItem[] = AI_COMPANY_IDS.map((id) => ({
        id,
        values: companyValues[id],
        shares: companyShares[id],
      }));

      // Peak global daily throughput calculation
      let peakDailyTokens = 0;
      let peakMonth = months[0] || '';
      for (let i = 0; i < totalValues.length; i++) {
        if (totalValues[i] >= peakDailyTokens) {
          peakDailyTokens = totalValues[i];
          peakMonth = months[i];
        }
      }

      // Top region at latest month
      const latestIdx = months.length - 1;
      let topRegionCode = 'CN';
      let topRegionValue = 0;
      let topRegionShare = 0;

      for (const s of regionSeries) {
        const val = s.values[latestIdx] ?? 0;
        if (val > topRegionValue) {
          topRegionValue = val;
          topRegionCode = s.code;
          topRegionShare = s.shares[latestIdx] ?? 0;
        }
      }

      const dataset: AiTokensDataset = {
        summary: {
          peakDailyTokens,
          peakMonth,
          topRegionCode,
          topRegionValue,
          topRegionShare,
        },
        regions: {
          months,
          total: totalValues,
          series: regionSeries,
        },
        companies: {
          months,
          total: companyTotals,
          series: companySeries,
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('ai-tokens');
      logger.success(`Exported ai-tokens dataset (${months.length} months, ${companySeries.length} companies)`);

      return dataset;
    },
    verbose,
  );
}

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAiTokensPipeline().catch((err) => {
    getLogger('ai-tokens').error('Fatal error running AI Tokens pipeline:', err);
    process.exit(1);
  });
}
