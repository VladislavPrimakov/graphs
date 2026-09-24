import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpaceLaunchesDataset } from '@/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const BASE_FILE = path.join(CACHE_DIR, 'launches_base.json');
const LATEST_CACHE_FILE = path.join(CACHE_DIR, 'latest_100.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/space-launches.json');

const API_HOST = 'll.thespacedevs.com';
const API_VERSION = '2.3.0';

const REGIONS = ['USA', 'China', 'Russia', 'Europe', 'Japan', 'India'] as const;
type Region = (typeof REGIONS)[number] | 'Others';

const COUNTRY_REGION_MAP: Record<string, Region> = {
  RUS: 'Russia',
  KAZ: 'Russia',
  SUN: 'Russia',
  RUSSIA: 'Russia',
  USA: 'USA',
  'UNITED STATES': 'USA',
  CHN: 'China',
  CHINA: 'China',
  JPN: 'Japan',
  JAPAN: 'Japan',
  IND: 'India',
  INDIA: 'India',
  EUROPE: 'Europe',
  OTHERS: 'Others',
};

const EUROPE_CODES = new Set(['FRA', 'GUF', 'ESA', 'PRT', 'ESP', 'ITA', 'DEU', 'SWE', 'NOR', 'GBR', 'NLD', 'BEL']);

interface StoredLaunch {
  id: string;
  year: number;
  net: string;
  leo_kg: number;
  cost: number | null;
  country: string;
}

interface ApiLaunchResult {
  id: string;
  net?: string;
  status?: { id: number };
  rocket?: {
    configuration?: {
      leo_capacity?: number | string | null;
      sso_capacity?: number | string | null;
      launch_cost?: number | string | null;
    };
  };
  pad?: {
    country?: { alpha_3_code?: string };
    location?: { country?: { alpha_3_code?: string } };
  };
  launch_service_provider?: { country_code?: string };
}

/** Maps raw ISO country codes to standardized region names. */
function mapCountry(code?: string): Region {
  if (!code) return 'Others';
  const clean = code.toUpperCase().trim();
  if (clean in COUNTRY_REGION_MAP) {
    return COUNTRY_REGION_MAP[clean];
  }
  if (EUROPE_CODES.has(clean)) {
    return 'Europe';
  }
  return 'Others';
}

/**
 * Executes the Space Launches ETL pipeline. Fetches recent orbital launches from Space Devs API, merges with historical archives, computes payload capacity time series and inflation-adjusted cost per
 * kg by decade.
 */
export async function runSpaceLaunchesPipeline(forceUpdate = false, verbose?: boolean): Promise<SpaceLaunchesDataset> {
  return runWithLogger(
    'space-launches',
    async () => {
      const logger = getLogger();
      logger.start('Starting Space Launches ETL pipeline');

      await ensureDir(BASE_FILE);

      const launchesById = new Map<string, StoredLaunch>();

      if (await fileExists(BASE_FILE)) {
        try {
          const baseList = await readJson<StoredLaunch[]>(BASE_FILE);
          for (const item of baseList) {
            if (item?.id) {
              launchesById.set(item.id, item);
            }
          }
          logger.debug(`Loaded ${launchesById.size} base launches from launches_base.json`);
        } catch (err) {
          logger.error(`Error loading ${BASE_FILE}:`, err);
        }
      }

      if (forceUpdate) {
        logger.debug('Force update (-u): clearing temporary cache files...');
        if (await fileExists(LATEST_CACHE_FILE)) {
          await fs.unlink(LATEST_CACHE_FILE).catch(() => {});
        }
      }

      logger.debug('Fetching latest 100 launches from Space Devs API...');
      let newLaunchesFetched: ApiLaunchResult[] = [];
      try {
        const url = `https://${API_HOST}/${API_VERSION}/launches/previous/?limit=100&mode=detailed`;
        const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 25000 });
        if (res.ok) {
          const data = (await res.json()) as { results?: ApiLaunchResult[] };
          newLaunchesFetched = data.results || [];
          await writeJson(LATEST_CACHE_FILE, data);
        } else {
          logger.warn(`Space Devs API returned HTTP ${res.status}. Falling back to cache.`);
        }
      } catch (err) {
        logger.warn(`Network error querying Space Devs API: ${err}. Falling back to cache.`);
      }

      if (newLaunchesFetched.length === 0 && (await fileExists(LATEST_CACHE_FILE))) {
        try {
          const cached = await readJson<{ results?: ApiLaunchResult[] }>(LATEST_CACHE_FILE);
          newLaunchesFetched = cached.results || [];
        } catch {
          // ignore
        }
      }

      let addedCount = 0;
      for (const launch of newLaunchesFetched) {
        if (launch.status?.id !== 3) continue; // Only successful launches
        if (!launch.net) continue;

        const launchYear = parseInt(launch.net.slice(0, 4), 10);
        if (Number.isNaN(launchYear)) continue;

        const config = launch.rocket?.configuration || {};
        let payloadKg = 0;

        if (config.leo_capacity != null) {
          const parsed = parseFloat(String(config.leo_capacity));
          if (!Number.isNaN(parsed) && parsed > 0) payloadKg = parsed;
        }
        if (payloadKg === 0 && config.sso_capacity != null) {
          const parsed = parseFloat(String(config.sso_capacity));
          if (!Number.isNaN(parsed) && parsed > 0) payloadKg = parsed;
        }
        if (payloadKg === 0) continue;

        const costVal = config.launch_cost != null ? parseFloat(String(config.launch_cost)) : null;
        const launchCost = costVal != null && !Number.isNaN(costVal) ? costVal : null;

        const countryCode = launch.pad?.location?.country?.alpha_3_code || launch.pad?.country?.alpha_3_code || launch.launch_service_provider?.country_code || '';

        if (!launchesById.has(launch.id)) {
          addedCount++;
        }

        launchesById.set(launch.id, {
          id: launch.id,
          year: launchYear,
          net: launch.net.slice(0, 10),
          leo_kg: payloadKg,
          cost: launchCost,
          country: countryCode,
        });
      }

      logger.debug(`Merged recent launches: ${addedCount} new additions (total ${launchesById.size})`);

      if (addedCount > 0 && (await fileExists(BASE_FILE))) {
        const allSorted = Array.from(launchesById.values()).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.net.localeCompare(b.net);
        });
        await writeJson(BASE_FILE, allSorted, 0);
        logger.debug(`Updated base archive launches_base.json (${allSorted.length} launches)`);
      }

      // Aggregate annual capacity
      const allLaunches = Array.from(launchesById.values());
      let minYear = Infinity;
      let maxYear = -Infinity;

      for (const item of allLaunches) {
        if (item.year < minYear) minYear = item.year;
        if (item.year > maxYear) maxYear = item.year;
      }

      if (minYear === Infinity) {
        throw new Error('No launch data available to process');
      }

      const allYears: number[] = [];
      for (let y = minYear; y <= maxYear; y++) {
        allYears.push(y);
      }

      // Yearly payload capacity by region (tons)
      const capacityMatrix: Record<string, Record<number, number>> = {};
      for (const r of REGIONS) {
        capacityMatrix[r] = {};
        for (const y of allYears) {
          capacityMatrix[r][y] = 0;
        }
      }

      // Decade cost calculations: sum(cost_per_kg) and count
      const decadeCostSums: Record<string, Record<number, { sum: number; count: number }>> = {};
      for (const r of REGIONS) {
        decadeCostSums[r] = {};
      }

      const decadesSet = new Set<number>();

      for (const item of allLaunches) {
        const r = mapCountry(item.country);
        if (r in capacityMatrix) {
          capacityMatrix[r][item.year] += item.leo_kg / 1000.0;
        }

        const decade = Math.floor(item.year / 10) * 10;
        decadesSet.add(decade);

        if (item.cost != null && item.cost > 0 && item.leo_kg > 0 && r in decadeCostSums) {
          const costPerKg = item.cost / item.leo_kg;
          if (!decadeCostSums[r][decade]) {
            decadeCostSums[r][decade] = { sum: 0, count: 0 };
          }
          decadeCostSums[r][decade].sum += costPerKg;
          decadeCostSums[r][decade].count += 1;
        }
      }

      const sortedDecades = Array.from(decadesSet).sort((a, b) => a - b);
      const decadeLabels = sortedDecades.map((d) => `${d}s`);

      const decadeSeries: Record<string, (number | null)[]> = {};
      for (const r of REGIONS) {
        decadeSeries[r] = sortedDecades.map((d) => {
          const stat = decadeCostSums[r][d];
          if (stat && stat.count > 0) {
            return Math.round(stat.sum / stat.count);
          }
          return null;
        });
      }

      const capacitySeries: Record<string, number[]> = {};
      for (const r of REGIONS) {
        capacitySeries[r] = allYears.map((y) => Math.round(capacityMatrix[r][y] * 10) / 10);
      }

      const totalCapacity = allYears.map((_, idx) => {
        let sum = 0;
        for (const r of REGIONS) {
          sum += capacitySeries[r][idx];
        }
        return Math.round(sum * 10) / 10;
      });

      const dataset: SpaceLaunchesDataset = {
        regions: [...REGIONS],
        payload_capacity: {
          years: allYears,
          totals: totalCapacity,
          series: capacitySeries,
        },
        decade_costs: {
          decades: decadeLabels,
          series: decadeSeries,
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('space-launches');
      logger.success(`Exported space-launches dataset (${allLaunches.length.toLocaleString()} launches, ${allYears[0]}–${allYears[allYears.length - 1]})`);
      return dataset;
    },
    verbose,
  );
}

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSpaceLaunchesPipeline().catch((err) => {
    getLogger('space-launches').error('Fatal error running Space Launches pipeline:', err);
    process.exit(1);
  });
}
