import { createHash } from 'node:crypto';
import { AI_COMPANY_IDS, type AiCompanyId, type CompanySeriesItem } from '@graphs/types/ai-tokens/tokens-by-company';
import type { RegionSeriesItem } from '@graphs/types/ai-tokens/tokens-by-region';
import { exportProjectSections, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchHeadMeta, fetchWithRetry, isRemoteMetaEqual, type RemoteFileMeta } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { percentage, round } from '@/utils/math';

const DATA_FILE = getPipelineDataPath('ai-tokens');

const URL_HOME = 'https://tokensperday.com';

interface RawPoint {
  t: number;
  v: number;
}

interface RawSeries {
  name: string;
  pts: RawPoint[];
}

interface RawViews {
  country: RawSeries[];
  company: RawSeries[];
}

interface AiTokensPipelineCache {
  meta?: {
    lastUpdated?: string;
    viewsSha256?: string;
    remoteMeta?: RemoteFileMeta | null;
  };
  views: RawViews;
  dataset: {
    summary: {
      peakDailyTokens: number;
      peakMonth: string;
      topRegionCode: string;
      topRegionValue: number;
      topRegionShare: number;
    };
    regions: {
      months: string[];
      total: number[];
      series: RegionSeriesItem[];
    };
    companies: {
      months: string[];
      total: number[];
      series: CompanySeriesItem[];
    };
  };
}

/** Extracts embedded time-series views JSON string and parsed object from the tokensperday homepage HTML, keeping only used fields. */
function extractViewsWithRaw(html: string): { views: RawViews; rawJson: string } {
  const match = html.match(/const views = (\{[\s\S]*?\});\s*(?:const|let|var|function)/);
  if (!match) {
    throw new Error('Failed to find const views JSON object in tokensperday.com');
  }
  const rawJson = match[1];
  const parsed = JSON.parse(rawJson) as { country?: RawSeries[]; company?: RawSeries[] };
  const sanitize = (list: RawSeries[] = []): RawSeries[] =>
    list.map((s) => ({
      name: s.name,
      pts: (s.pts || []).map((p) => ({ t: p.t, v: p.v })),
    }));

  return {
    views: {
      country: sanitize(parsed.country),
      company: sanitize(parsed.company),
    },
    rawJson,
  };
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

/** Runs the AI Tokens ETL Pipeline. Scrapes tokensperday.com, reconciles regional & company metrics, and exports section datasets. */
export async function runAiTokensPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'ai-tokens',
    async () => {
      const logger = getLogger();
      logger.start('Starting AI Tokens ETL pipeline');

      let cache: AiTokensPipelineCache | null = null;
      if (await fileExists(DATA_FILE)) {
        try {
          cache = await readJson<AiTokensPipelineCache>(DATA_FILE);
        } catch {
          logger.warn('Could not read existing data.json file');
        }
      }

      const hasValidDataset = Boolean(cache?.dataset?.regions?.months?.length) && Boolean(cache?.dataset?.summary?.peakDailyTokens);

      let remoteMeta: RemoteFileMeta | null = null;
      let rawJson = '';
      let views: RawViews | null = null;
      let viewsSha256 = '';

      // 1. Fast metadata check via HTTP HEAD if server provides ETag / Last-Modified
      if (!forceUpdate && hasValidDataset && cache?.meta?.remoteMeta) {
        logger.debug('Checking tokensperday.com HTTP metadata via HEAD...');
        remoteMeta = await fetchHeadMeta(URL_HOME);
        if (remoteMeta && isRemoteMetaEqual(cache.meta.remoteMeta, remoteMeta) && remoteMeta.etag) {
          logger.info('TokensPerDay remote metadata matches (ETag unchanged). Using cached dataset.');
          await exportProjectSections('ai-tokens', {
            'tokens-by-region': { summary: cache.dataset.summary, regions: cache.dataset.regions },
            'tokens-by-company': { summary: cache.dataset.summary, companies: cache.dataset.companies },
          });
          return;
        }
      }

      // 2. Fetch homepage and compare SHA-256 hash of embedded views payload
      try {
        logger.debug(`Fetching homepage from ${URL_HOME}...`);
        const res = await fetchWithRetry(URL_HOME, { retries: 2, timeoutMs: 25000 });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!remoteMeta) {
          remoteMeta = {
            etag: res.headers.get('etag'),
            lastModified: res.headers.get('last-modified'),
            contentLength: res.headers.get('content-length'),
          };
        }

        const html = await res.text();
        const extracted = extractViewsWithRaw(html);
        rawJson = extracted.rawJson;
        views = extracted.views;
        viewsSha256 = createHash('sha256').update(rawJson).digest('hex');

        if (!forceUpdate && hasValidDataset && cache?.meta?.viewsSha256 === viewsSha256) {
          logger.info('TokensPerDay time-series views unchanged (SHA-256 match). Using cached dataset.');
          await exportProjectSections('ai-tokens', {
            'tokens-by-region': { summary: cache.dataset.summary, regions: cache.dataset.regions },
            'tokens-by-company': { summary: cache.dataset.summary, companies: cache.dataset.companies },
          });
          return;
        }

        logger.info('New tokensperday views data detected. Processing updated series...');
      } catch (err) {
        if (hasValidDataset && cache) {
          logger.warn(`Network query failed (${err instanceof Error ? err.message : String(err)}). Using cached dataset.`);
          await exportProjectSections('ai-tokens', {
            'tokens-by-region': { summary: cache.dataset.summary, regions: cache.dataset.regions },
            'tokens-by-company': { summary: cache.dataset.summary, companies: cache.dataset.companies },
          });
          return;
        }
        throw new Error(`Failed to fetch ${URL_HOME} and no valid cache available: ${err}`);
      }

      if (!views) {
        if (!cache?.views) throw new Error('No views available to process');
        views = cache.views;
      }

      // Dynamically determine month range from data up to latest available point
      let maxTs = 0;
      for (const list of [views.country, views.company]) {
        for (const s of list || []) {
          for (const p of s.pts || []) {
            if (p.t > maxTs) maxTs = p.t;
          }
        }
      }

      const months: string[] = [];
      const current = new Date('2024-01-15T00:00:00Z');
      const maxDate = maxTs > 0 ? new Date(maxTs) : new Date();
      maxDate.setUTCDate(15);

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
          const val = round(getLatestValue(r.pts, targetTs), 2);
          r.values.push(val);
          monthTotal += val;
        }

        monthTotal = round(monthTotal, 2);
        totalValues.push(monthTotal);

        for (const r of regionRaw) {
          const currentVal = r.values[r.values.length - 1];
          const share = percentage(currentVal, monthTotal, 1);
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
          const val = round(getLatestValue(pts, targetTs), 1);
          companyValues[id].push(val);
          monthCompanyTotal += val;
        }

        monthCompanyTotal = round(monthCompanyTotal, 1);
        companyTotals.push(monthCompanyTotal);

        for (const id of AI_COMPANY_IDS) {
          const val = companyValues[id][companyValues[id].length - 1];
          const share = percentage(val, monthCompanyTotal, 1);
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

      const dataset = {
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

      await writeJson(
        DATA_FILE,
        {
          meta: {
            lastUpdated: new Date().toISOString(),
            viewsSha256: viewsSha256 || cache?.meta?.viewsSha256,
            remoteMeta: remoteMeta || cache?.meta?.remoteMeta,
          },
          views,
          dataset,
        },
        0,
      );
      await exportProjectSections('ai-tokens', {
        'tokens-by-region': { summary: dataset.summary, regions: dataset.regions },
        'tokens-by-company': { summary: dataset.summary, companies: dataset.companies },
      });
      logger.success(`Exported ai-tokens section datasets (${months.length} months, ${companySeries.length} companies)`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runAiTokensPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('ai-tokens').error('Fatal error running AI Tokens pipeline:', err);
    process.exit(1);
  });
}
