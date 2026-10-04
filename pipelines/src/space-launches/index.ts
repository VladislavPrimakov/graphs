import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpaceLaunchesDataset, SpaceLaunchesSummary } from '@graphs/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';
import { resolveRegionCode } from '../utils/region.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const BASE_FILE = path.join(CACHE_DIR, 'launches_base.json');
const LATEST_CACHE_FILE = path.join(CACHE_DIR, 'latest_100.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/space-launches.json');

const API_HOST = 'll.thespacedevs.com';
const API_VERSION = '2.3.0';

interface StoredLaunch {
  id: string;
  year: number;
  net: string;
  leo_kg: number;
  cost: number | null;
  country: string;
  status: number;
  rocket?: string;
}

interface ApiRocketConfiguration {
  id?: number;
  name?: string;
  full_name?: string;
  leo_capacity?: number | string | null;
  sso_capacity?: number | string | null;
  launch_cost?: number | string | null;
}

interface ApiLaunchResult {
  id: string;
  net?: string;
  status?: { id: number };
  mission?: {
    orbit?: {
      name?: string;
      abbrev?: string;
    };
  };
  rocket?: {
    configuration?: ApiRocketConfiguration;
  };
  pad?: {
    country?: { alpha_3_code?: string };
    location?: { country?: { alpha_3_code?: string } };
  };
  launch_service_provider?: { country_code?: string };
}

/** European space launch sites and ESA member territory codes. */
const EUROPE_SPACE_CODES = new Set(['FRA', 'GUF', 'ESA', 'PRT', 'ESP', 'ITA', 'DEU', 'SWE', 'NOR', 'GBR', 'NLD', 'BEL']);

/** Verified historical LEO payload capacities (in kg) for rocket configurations where Launch Library 2 has null. */
const FALLBACK_LEO_CAPACITY: Record<number, number> = {
  // Soviet/Russian launchers
  102: 1500, // Kosmos-3M (11K65M)
  104: 5900, // Voskhod
  106: 7000, // Molniya-M 2BL (LEO stage capability)
  335: 7000, // Molniya 8K78M-PVB
  80: 20600, // Proton K/DM-2
  349: 20600, // Proton-K/DM
  350: 20600, // Proton-K/DM-2M
  95: 20600, // Proton-K
  191: 20600, // Proton / UR-500 K/D
  347: 20600, // Proton-K/D-1
  94: 22000, // Proton-M DM-2 Enhanced
  87: 22000, // Proton-M Briz-M Enhanced
  96: 6500, // Soyuz (11A511)
  212: 8200, // Soyuz 2.1a Fregat
  57: 7000, // Soyuz 2.1a Volga
  555: 8200, // Soyuz 2.1b Volga
  351: 5000, // R-36O 8K69 (FOBS)
  352: 5000, // R-36O 8K69M (FOBS)
  325: 1500, // K65M-RB
  76: 1700, // Strela
  382: 532, // Start-1.2
  468: 500, // Sputnik 8K74PS
  469: 1327, // Sputnik 8A91
  53: 3800, // Angara 1.2pp

  // Ukrainian / Sea Launch
  11: 13740, // Zenit 3SL
  91: 13740, // Zenit 3SLB
  89: 13740, // Zenit 2M
  58: 13740, // Zenit
  31: 4500, // Dnepr 1

  // European launchers
  20: 21000, // Ariane 5 ECA
  215: 21000, // Ariane 5 ECA+
  149: 18000, // Ariane 5 GS
  146: 18500, // Ariane 5 G+
  221: 4900, // Ariane 3
  220: 4900, // Ariane 2

  // US Launchers - Delta family
  159: 5080, // Delta II 7925
  140: 5080, // Delta II 7925-9.5
  157: 5080, // Delta II 7925-10C
  151: 5080, // Delta II 7925-10L
  308: 5080, // Delta II 7925-10
  309: 5080, // Delta II 7925-8
  155: 6000, // Delta II 7925H-9.5
  306: 5000, // Delta II 7920-10L
  307: 5000, // Delta II 7920-8
  467: 3190, // Delta II 7420-10C
  303: 3190, // Delta II 7425-10
  304: 3190, // Delta II 7425-9.5
  305: 3190, // Delta II 7426-9.5
  302: 2800, // Delta II 7326-9.5
  298: 3800, // Delta II 6920-10
  299: 3800, // Delta II 6920-8
  285: 1800, // Delta 2910
  295: 2000, // Delta 3924
  288: 2000, // Delta 3910
  292: 2900, // Delta 3920
  293: 2900, // Delta 3920-8
  290: 2000, // Delta 3913
  283: 1300, // Delta 2310
  275: 750, // Delta 0300
  282: 1300, // Delta 1914
  281: 1300, // Delta 1913
  279: 1300, // Delta 1900
  280: 1300, // Delta 1910
  277: 1000, // Delta 1410
  189: 450, // Thor-Delta
  406: 550, // Thor Delta G
  411: 650, // Thor Delta N
  412: 700, // Thor Delta N6

  // US Launchers - Thor / Agena
  417: 1500, // Thor SLV-2A Agena D
  186: 1200, // Thor DM-21 Agena-B
  418: 1500, // Thorad SLV-2G Agena D
  419: 1500, // Thorad SLV-2H Agena D
  393: 1500, // Thor Agena D
  415: 1400, // Thor SLV-2 Agena D
  416: 1200, // Thor SLV-2A Agena B
  395: 450, // Thor Burner 2
  396: 450, // Thor Burner 2A
  394: 450, // Thor Burner 1
  413: 450, // Thor MG-18
  390: 150, // Thor Able III
  391: 150, // Thor Able IV
  389: 150, // Thor Able II

  // US Launchers - Atlas & Titan
  183: 1400, // Atlas LV-3 Agena B
  238: 1500, // SM-65E Atlas
  244: 1500, // SM-65F Atlas
  249: 1500, // Atlas F/SVS
  246: 1500, // Atlas F MSD
  242: 1500, // Atlas E/SGS-2
  248: 1500, // Atlas F/PTS
  245: 1500, // Atlas F/Agena D
  247: 1500, // Atlas F/OIS
  235: 3900, // Atlas LV-3C Centaur
  236: 4100, // Atlas LV-3C Centaur D
  426: 14500, // Titan 34D Transtage
  425: 14500, // Titan 34D IUS
  130: 21680, // Titan IVB/Centaur
  516: 21600, // Vulcan VC4S

  // US Launchers - Scout & Minotaur
  359: 140, // Scout B-1
  357: 100, // Scout A-1
  366: 100, // Scout X-2M
  369: 100, // Scout X-3M
  82: 1400, // Minotaur C
  387: 1058, // Minotaur-C 3210

  // Chinese launchers
  64: 4200, // Long March 4C
  71: 8500, // Long March 3A
  90: 9100, // Long March 3C
  36: 9100, // Long March 3C/YZ-1
  54: 1500, // Long March 6
  216: 13500, // Long March 7A
  66: 3500, // Long March 2C/SMA
  176: 3500, // Long March 2D/YZ-3
  92: 300, // Long March 1
  65: 300, // Kuaizhou
  125: 350, // Kaituozhe-2
  109: 14000, // Long March 7/YZ-1A
  123: 25000, // Long March 5/YZ-2

  // Japanese launchers
  322: 12000, // H-IIA 2024
  48: 15000, // H-IIA 204
  321: 11000, // H-IIA 2022
  486: 12000, // H3-22
  204: 16000, // H3-24

  // Indian launchers
  168: 5000, // GSLV Mk. II

  // Israeli launchers
  44: 250, // Shavit
  110: 350, // Shavit-2

  // Iranian launchers
  39: 50, // Safir
  142: 350, // Simorgh

  // South / North Korean launchers
  12: 100, // KSLV Naro-1
  67: 100, // Unha-3
  86: 100, // Unha
  495: 300, // Chollima-1

  // Lunar / Sample return ascenders
  513: 4700, // Apollo LM Ascent Stage
  514: 1880, // Luna Ascent Stage
  515: 800, // Chang'e Sample Ascender
};

/** Extracts LEO payload capacity with fallback support for uncatalogued configurations. */
function extractPayloadKg(conf?: ApiRocketConfiguration): number {
  if (!conf) return 0;
  if (conf.leo_capacity != null) {
    const p = parseFloat(String(conf.leo_capacity));
    if (!Number.isNaN(p) && p > 0) return p;
  }
  if (conf.sso_capacity != null) {
    const p = parseFloat(String(conf.sso_capacity));
    if (!Number.isNaN(p) && p > 0) return p;
  }
  if (conf.id && FALLBACK_LEO_CAPACITY[conf.id]) {
    return FALLBACK_LEO_CAPACITY[conf.id];
  }
  return 0;
}

/** Maps raw ISO country codes, air/sea drops, or launch pad codes to standardized space power codes. */
function resolveLaunchRegion(launch: StoredLaunch): string {
  const clean = (launch.country || '').toUpperCase().trim();
  const r = (launch.rocket || '').toLowerCase();

  // 1. Air and sea launches or unclassified territory codes
  if (clean === '???' || !clean || clean === 'EMPTY') {
    if (r.includes('pegasus') || r.includes('launcherone') || r.includes('apollo lm')) return 'US';
    if (r.includes('shtil') || r.includes('luna') || r.includes('zenit')) return 'RU';
    if (r.includes('shavit')) return 'IL';
    if (r.includes("chang'e")) return 'CN';
    if (r.includes('south korean')) return 'KR';
    if (launch.leo_kg === 443 || launch.leo_kg === 500) return 'US';
    if (launch.leo_kg === 430) return 'RU';
    if (launch.leo_kg === 350 || launch.leo_kg === 250) return 'IL';
    if (launch.leo_kg === 100) return 'KR';
    return 'Others';
  }

  // 2. US launches from US territory or Marshall Islands
  if (clean === 'USA' || clean === 'MHL') return 'US';

  // 3. Soviet/Russian launches from Russia or Baikonur Cosmodrome (Kazakhstan)
  if (clean === 'RUS' || clean === 'KAZ' || clean === 'SUN') return 'RU';

  // 4. China
  if (clean === 'CHN') return 'CN';

  // 5. European space program: Guiana Space Centre (CSG), French Diamant, Italian San Marco, Norway Andøya
  if (EUROPE_SPACE_CODES.has(clean)) return 'EU';

  // 6. Japan
  if (clean === 'JPN') return 'JP';

  // 7. India
  if (clean === 'IND') return 'IN';

  // 8. New Zealand (Rocket Lab Mahia Launch Complex)
  if (clean === 'NZL') return 'NZ';

  // 9. Iran
  if (clean === 'IRN') return 'IR';

  // 10. South Korea (Naro Space Center)
  if (clean === 'KOR') return 'KR';

  // 11. Israel (Palmachim)
  if (clean === 'ISR') return 'IL';

  // 12. Australia (Woomera)
  if (clean === 'AUS') return 'AU';

  const resolved = resolveRegionCode(clean);
  return resolved || 'Others';
}

/**
 * Executes the Space Launches ETL pipeline. Fetches recent orbital launches from Space Devs API, merges with historical archives, computes payload capacity time series, decade costs, and decade failure rates.
 */
export async function runSpaceLaunchesPipeline(forceUpdate = false, verbose?: boolean): Promise<SpaceLaunchesDataset> {
  return runWithLogger(
    'space-launches',
    async () => {
      const logger = getLogger();
      logger.start('Starting Space Launches ETL pipeline');

      await ensureDir(BASE_FILE);

      const launchesById = new Map<string, StoredLaunch>();

      // Ingest from complete raw cache files if base is small or missing
      if (await fileExists(CACHE_DIR)) {
        try {
          const files = (await fs.readdir(CACHE_DIR)).filter((f) => f.startsWith('launches_all_offset_') && f.endsWith('.json'));
          if (files.length > 0) {
            for (const f of files) {
              const content = await readJson<{ results?: ApiLaunchResult[] }>(path.join(CACHE_DIR, f));
              for (const l of content.results || []) {
                if (!l?.id || !l.net) continue;
                const isSuborbital = l.mission?.orbit?.name === 'Suborbital' || l.mission?.orbit?.abbrev === 'Sub';
                if (isSuborbital) continue;

                const status = l.status?.id || 0;
                if (status !== 3 && status !== 4 && status !== 7) continue;

                const year = parseInt(l.net.slice(0, 4), 10);
                if (Number.isNaN(year) || year > 2026) continue;

                const payloadKg = extractPayloadKg(l.rocket?.configuration);
                const costVal = l.rocket?.configuration?.launch_cost != null ? parseFloat(String(l.rocket.configuration.launch_cost)) : null;
                const cost = costVal != null && !Number.isNaN(costVal) && costVal > 0 ? costVal : null;
                const countryCode = l.pad?.location?.country?.alpha_3_code || l.pad?.country?.alpha_3_code || l.launch_service_provider?.country_code || '';
                const rName = l.rocket?.configuration?.full_name || l.rocket?.configuration?.name || '';

                launchesById.set(l.id, {
                  id: l.id,
                  year,
                  net: l.net.slice(0, 10),
                  leo_kg: payloadKg,
                  cost,
                  country: countryCode,
                  status,
                  rocket: rName,
                });
              }
            }
            logger.debug(`Ingested ${launchesById.size} orbital launches from local cache archives`);
          }
        } catch (err) {
          logger.warn('Could not read raw cache offsets:', err);
        }
      }

      if (await fileExists(BASE_FILE)) {
        try {
          const baseList = await readJson<StoredLaunch[]>(BASE_FILE);
          for (const item of baseList) {
            if (item?.id && item.year <= 2026 && (item.status === 3 || item.status === 4 || item.status === 7) && !launchesById.has(item.id)) {
              launchesById.set(item.id, item);
            }
          }
          logger.debug(`Loaded base archive (${launchesById.size} total launches)`);
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
        if (!launch.net) continue;
        const isSuborbital = launch.mission?.orbit?.name === 'Suborbital' || launch.mission?.orbit?.abbrev === 'Sub';
        if (isSuborbital) continue;

        const status = launch.status?.id || 0;
        if (status !== 3 && status !== 4 && status !== 7) continue;

        const launchYear = parseInt(launch.net.slice(0, 4), 10);
        if (Number.isNaN(launchYear) || launchYear > 2026) continue;

        const payloadKg = extractPayloadKg(launch.rocket?.configuration);
        const costVal = launch.rocket?.configuration?.launch_cost != null ? parseFloat(String(launch.rocket.configuration.launch_cost)) : null;
        const launchCost = costVal != null && !Number.isNaN(costVal) && costVal > 0 ? costVal : null;
        const countryCode = launch.pad?.location?.country?.alpha_3_code || launch.pad?.country?.alpha_3_code || launch.launch_service_provider?.country_code || '';
        const rName = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '';

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
          status,
          rocket: rName,
        });
      }

      logger.debug(`Merged recent launches: ${addedCount} new additions (total ${launchesById.size})`);

      const allLaunches = Array.from(launchesById.values());
      const allSorted = [...allLaunches].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.net.localeCompare(b.net);
      });
      await writeJson(BASE_FILE, allSorted, 0);

      // Determine chronological bounds
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

      // Compute total delivered mass per entity across all successful launches to sort them
      const entityTotalMass = new Map<string, number>();
      for (const item of allLaunches) {
        if (item.status === 3) {
          const r = resolveLaunchRegion(item);
          if (r && r !== 'Others') {
            entityTotalMass.set(r, (entityTotalMass.get(r) || 0) + item.leo_kg / 1000.0);
          }
        }
      }

      // Sort entities descending by total delivered mass: US, RU, CN, EU, JP, IN, NZ, KR, IL, IR, AU
      const sortedRegions = Array.from(entityTotalMass.keys()).sort((a, b) => (entityTotalMass.get(b) || 0) - (entityTotalMass.get(a) || 0));

      // Yearly payload capacity by region (tons) and annual launch counts (successful only)
      const capacityMatrix: Record<string, Record<number, number>> = {};
      const launchMatrix: Record<string, Record<number, number>> = {};
      for (const r of sortedRegions) {
        capacityMatrix[r] = {};
        launchMatrix[r] = {};
        for (const y of allYears) {
          capacityMatrix[r][y] = 0;
          launchMatrix[r][y] = 0;
        }
      }

      // Decade cost, mass, launch counts, and attempt/failure matrices
      const decadeCostSums: Record<string, Record<number, { sum: number; count: number }>> = {};
      const decadeLaunchMatrix: Record<string, Record<number, number>> = {};
      const decadeMassMatrix: Record<string, Record<number, number>> = {};
      const decadeAttemptsMatrix: Record<string, Record<number, number>> = {};
      const decadeFailuresMatrix: Record<string, Record<number, number>> = {};

      for (const r of sortedRegions) {
        decadeCostSums[r] = {};
        decadeLaunchMatrix[r] = {};
        decadeMassMatrix[r] = {};
        decadeAttemptsMatrix[r] = {};
        decadeFailuresMatrix[r] = {};
      }

      const decadesSet = new Set<number>();

      for (const item of allLaunches) {
        const r = resolveLaunchRegion(item);
        const decade = Math.floor(item.year / 10) * 10;
        decadesSet.add(decade);

        // Track orbital attempts and failures across all past attempts (3 = success, 4 = failure, 7 = partial failure)
        if (decadeAttemptsMatrix[r]) {
          decadeAttemptsMatrix[r][decade] = (decadeAttemptsMatrix[r][decade] || 0) + 1;
          if (item.status === 4 || item.status === 7) {
            decadeFailuresMatrix[r][decade] = (decadeFailuresMatrix[r][decade] || 0) + 1;
          }
        }

        // Mass and capacity metrics apply to successful launches (status === 3)
        if (item.status === 3) {
          if (capacityMatrix[r]) {
            capacityMatrix[r][item.year] += item.leo_kg / 1000.0;
            launchMatrix[r][item.year] += 1;
          }

          if (decadeLaunchMatrix[r]) {
            decadeLaunchMatrix[r][decade] = (decadeLaunchMatrix[r][decade] || 0) + 1;
            decadeMassMatrix[r][decade] = (decadeMassMatrix[r][decade] || 0) + item.leo_kg;
          }

          if (item.cost != null && item.cost > 0 && item.leo_kg > 0 && decadeCostSums[r]) {
            const costPerKg = item.cost / item.leo_kg;
            if (!decadeCostSums[r][decade]) {
              decadeCostSums[r][decade] = { sum: 0, count: 0 };
            }
            decadeCostSums[r][decade].sum += costPerKg;
            decadeCostSums[r][decade].count += 1;
          }
        }
      }

      const sortedDecades = Array.from(decadesSet).sort((a, b) => a - b);
      const decadeLabels = sortedDecades.map((d) => `${d}s`);

      // 1. Decade Costs
      const decadeSeries: Record<string, (number | null)[]> = {};
      const decadeLaunchSeries: Record<string, number[]> = {};
      const costRegions: string[] = [];
      for (const r of sortedRegions) {
        const hasAnyCost = sortedDecades.some((d) => (decadeCostSums[r][d]?.count || 0) > 0);
        if (hasAnyCost) {
          costRegions.push(r);
          decadeSeries[r] = sortedDecades.map((d) => {
            const stat = decadeCostSums[r][d];
            if (stat && stat.count > 0) {
              return Math.round(stat.sum / stat.count);
            }
            return null;
          });
          decadeLaunchSeries[r] = sortedDecades.map((d) => decadeCostSums[r]?.[d]?.count || 0);
        }
      }

      const decadeTotalLaunches = sortedDecades.map((d) => {
        let count = 0;
        for (const r of costRegions) {
          count += decadeCostSums[r]?.[d]?.count || 0;
        }
        return count;
      });

      const decadeTotalAvgCost = sortedDecades.map((d) => {
        let sum = 0;
        let count = 0;
        for (const r of costRegions) {
          const stat = decadeCostSums[r]?.[d];
          if (stat && stat.count > 0) {
            sum += stat.sum;
            count += stat.count;
          }
        }
        return count > 0 ? Math.round(sum / count) : null;
      });

      // 2. Annual Capacity
      const capacitySeries: Record<string, number[]> = {};
      const annualLaunchSeries: Record<string, number[]> = {};

      for (const r of sortedRegions) {
        capacitySeries[r] = allYears.map((y) => Math.round(capacityMatrix[r][y] * 10) / 10);
        annualLaunchSeries[r] = allYears.map((y) => launchMatrix[r][y]);
      }

      // 3. Average Payload Mass per Decade
      const avgPayloadSeries: Record<string, (number | null)[]> = {};
      const avgPayloadLaunchSeries: Record<string, number[]> = {};

      for (const r of sortedRegions) {
        avgPayloadSeries[r] = sortedDecades.map((d) => {
          const count = decadeLaunchMatrix[r]?.[d] || 0;
          if (count > 0) {
            const totalKg = decadeMassMatrix[r]?.[d] || 0;
            return Math.round(totalKg / count);
          }
          return null;
        });
        avgPayloadLaunchSeries[r] = sortedDecades.map((d) => decadeLaunchMatrix[r]?.[d] || 0);
      }

      const avgPayloadTotalLaunches = sortedDecades.map((d) => {
        let count = 0;
        for (const r of sortedRegions) {
          count += decadeLaunchMatrix[r]?.[d] || 0;
        }
        return count;
      });

      const avgPayloadTotalAvg = sortedDecades.map((d) => {
        let mass = 0;
        let count = 0;
        for (const r of sortedRegions) {
          mass += decadeMassMatrix[r]?.[d] || 0;
          count += decadeLaunchMatrix[r]?.[d] || 0;
        }
        return count > 0 ? Math.round(mass / count) : null;
      });

      // 4. Failure Rates per Decade
      const failureRateSeries: Record<string, (number | null)[]> = {};
      const failureAttemptsSeries: Record<string, number[]> = {};
      const failureCountsSeries: Record<string, number[]> = {};

      for (const r of sortedRegions) {
        failureRateSeries[r] = sortedDecades.map((d) => {
          const attempts = decadeAttemptsMatrix[r]?.[d] || 0;
          if (attempts > 0) {
            const fails = decadeFailuresMatrix[r]?.[d] || 0;
            return Math.round((fails / attempts) * 1000) / 10;
          }
          return null;
        });
        failureAttemptsSeries[r] = sortedDecades.map((d) => decadeAttemptsMatrix[r]?.[d] || 0);
        failureCountsSeries[r] = sortedDecades.map((d) => decadeFailuresMatrix[r]?.[d] || 0);
      }

      const failureRateTotalAttempts = sortedDecades.map((d) => {
        let count = 0;
        for (const r of sortedRegions) {
          count += decadeAttemptsMatrix[r]?.[d] || 0;
        }
        return count;
      });

      const failureRateTotalFailures = sortedDecades.map((d) => {
        let count = 0;
        for (const r of sortedRegions) {
          count += decadeFailuresMatrix[r]?.[d] || 0;
        }
        return count;
      });

      const failureRateTotalRate = sortedDecades.map((d) => {
        let attempts = 0;
        let fails = 0;
        for (const r of sortedRegions) {
          attempts += decadeAttemptsMatrix[r]?.[d] || 0;
          fails += decadeFailuresMatrix[r]?.[d] || 0;
        }
        return attempts > 0 ? Math.round((fails / attempts) * 1000) / 10 : null;
      });

      // Precomputed Macro Summary KPIs
      let totalPayloadTons = 0;
      for (const series of Object.values(capacitySeries)) {
        for (const val of series) {
          totalPayloadTons += val;
        }
      }
      totalPayloadTons = Math.round(totalPayloadTons);

      let maxRegionAllTimeMass = 0;
      let leaderAllTimeRegion = '';
      for (const [r, series] of Object.entries(capacitySeries)) {
        const sum = series.reduce((a, b) => a + b, 0);
        if (sum > maxRegionAllTimeMass) {
          maxRegionAllTimeMass = sum;
          leaderAllTimeRegion = r;
        }
      }
      const leaderAllTimeMassTons = Math.round(maxRegionAllTimeMass);
      const leaderAllTimeShare = totalPayloadTons > 0 ? Math.round((leaderAllTimeMassTons / totalPayloadTons) * 1000) / 10 : 0;

      let lowestCostPerKg = Number.POSITIVE_INFINITY;
      let lowestCostRegion = '';
      let lowestCostDecade = '';
      for (const [r, vals] of Object.entries(decadeSeries)) {
        vals.forEach((v, idx) => {
          if (v != null && v < lowestCostPerKg) {
            lowestCostPerKg = v;
            lowestCostRegion = r;
            lowestCostDecade = decadeLabels[idx];
          }
        });
      }

      let minDecadeAvgCost = Number.POSITIVE_INFINITY;
      let maxDecadeAvgCost = Number.NEGATIVE_INFINITY;
      let bestDecadeAvgCostDecade = '';
      let worstDecadeAvgCostDecade = '';

      decadeLabels.forEach((d, idx) => {
        let weightedCostSum = 0;
        let launchSum = 0;
        for (const r of Object.keys(decadeSeries)) {
          const cost = decadeSeries[r]?.[idx];
          const l = decadeLaunchSeries[r]?.[idx] || 0;
          if (cost != null && l > 0) {
            weightedCostSum += cost * l;
            launchSum += l;
          }
        }
        if (launchSum > 0) {
          const avgCost = Math.round(weightedCostSum / launchSum);
          if (avgCost < minDecadeAvgCost) {
            minDecadeAvgCost = avgCost;
            bestDecadeAvgCostDecade = d;
          }
          if (avgCost > maxDecadeAvgCost) {
            maxDecadeAvgCost = avgCost;
            worstDecadeAvgCostDecade = d;
          }
        }
      });

      const baselineCost = maxDecadeAvgCost > 0 ? maxDecadeAvgCost : 0;
      const bestDecadeAvgCost = minDecadeAvgCost < Number.POSITIVE_INFINITY ? minDecadeAvgCost : 0;
      const costReductionFactor = bestDecadeAvgCost > 0 ? Math.round((baselineCost / bestDecadeAvgCost) * 10) / 10 : 0;

      let bestDecadeCountryAvgPayloadKg = 0;
      let bestDecadeCountryAvgPayloadRegion = '';
      let bestDecadeCountryAvgPayloadDecade = '';

      sortedDecades.forEach((_d, idx) => {
        for (const r of sortedRegions) {
          const avg = avgPayloadSeries[r]?.[idx];
          const l = avgPayloadLaunchSeries[r]?.[idx] || 0;
          if (avg != null && l > 0 && avg > bestDecadeCountryAvgPayloadKg) {
            bestDecadeCountryAvgPayloadKg = avg;
            bestDecadeCountryAvgPayloadRegion = r;
            bestDecadeCountryAvgPayloadDecade = decadeLabels[idx];
          }
        }
      });

      let minDecadeAvgPayload = Number.POSITIVE_INFINITY;
      let maxDecadeAvgPayload = Number.NEGATIVE_INFINITY;
      let worstDecadeAvgPayloadDecade = '';
      let bestDecadeAvgPayloadDecade = '';

      sortedDecades.forEach((_d, idx) => {
        let decMass = 0;
        let decLaunches = 0;
        for (const r of sortedRegions) {
          const l = avgPayloadLaunchSeries[r]?.[idx] || 0;
          const avg = avgPayloadSeries[r]?.[idx] || 0;
          decMass += avg * l;
          decLaunches += l;
        }
        if (decLaunches > 0) {
          const avgP = decMass / decLaunches;
          if (avgP < minDecadeAvgPayload) {
            minDecadeAvgPayload = avgP;
            worstDecadeAvgPayloadDecade = decadeLabels[idx];
          }
          if (avgP > maxDecadeAvgPayload) {
            maxDecadeAvgPayload = avgP;
            bestDecadeAvgPayloadDecade = decadeLabels[idx];
          }
        }
      });

      const baselineAvgPayloadKg = minDecadeAvgPayload < Number.POSITIVE_INFINITY ? Math.round(minDecadeAvgPayload) : 0;
      const currentDecadeAvgPayloadKg = maxDecadeAvgPayload > 0 ? Math.round(maxDecadeAvgPayload) : 0;
      const payloadGrowthFactor = baselineAvgPayloadKg > 0 ? Math.round((currentDecadeAvgPayloadKg / baselineAvgPayloadKg) * 10) / 10 : 0;

      let totalAttempts = 0;
      let totalFailures = 0;

      for (const r of sortedRegions) {
        const atts = failureAttemptsSeries[r] || [];
        const fails = failureCountsSeries[r] || [];
        totalAttempts += atts.reduce((a, b) => a + b, 0);
        totalFailures += fails.reduce((a, b) => a + b, 0);
      }

      const globalSuccessRate = totalAttempts > 0 ? Math.round(((totalAttempts - totalFailures) / totalAttempts) * 1000) / 10 : 0;

      // Decade-level global reliability and growth from worst to best decade
      let minDecadeSuccessRate = Number.POSITIVE_INFINITY;
      let maxDecadeSuccessRate = Number.NEGATIVE_INFINITY;
      let worstDecadeLabel = '';
      let bestGlobalDecadeLabel = '';

      sortedDecades.forEach((_d, idx) => {
        let decAttempts = 0;
        let decFailures = 0;
        for (const r of sortedRegions) {
          decAttempts += failureAttemptsSeries[r]?.[idx] || 0;
          decFailures += failureCountsSeries[r]?.[idx] || 0;
        }
        if (decAttempts > 0) {
          const sRate = ((decAttempts - decFailures) / decAttempts) * 100;
          if (sRate < minDecadeSuccessRate) {
            minDecadeSuccessRate = sRate;
            worstDecadeLabel = decadeLabels[idx];
          }
          if (sRate > maxDecadeSuccessRate) {
            maxDecadeSuccessRate = sRate;
            bestGlobalDecadeLabel = decadeLabels[idx];
          }
        }
      });
      const reliabilityGrowthFactor = minDecadeSuccessRate > 0 && minDecadeSuccessRate < Number.POSITIVE_INFINITY ? Math.round((maxDecadeSuccessRate / minDecadeSuccessRate) * 10) / 10 : 1;
      const worstDecadeReliabilityRate = minDecadeSuccessRate < Number.POSITIVE_INFINITY ? Math.round(minDecadeSuccessRate * 10) / 10 : 0;
      const bestDecadeGlobalReliabilityRate = maxDecadeSuccessRate > Number.NEGATIVE_INFINITY ? Math.round(maxDecadeSuccessRate * 10) / 10 : 0;

      // Best nation reliability in a single decade with > 50 attempts
      let bestDecadeReliabilityRegion = '';
      let bestDecadeReliabilityRate = 0;
      let bestDecadeReliabilityDecade = '';

      sortedDecades.forEach((_d, idx) => {
        for (const r of sortedRegions) {
          const atts = failureAttemptsSeries[r]?.[idx] || 0;
          const fails = failureCountsSeries[r]?.[idx] || 0;
          if (atts > 50) {
            const sRate = Math.round(((atts - fails) / atts) * 1000) / 10;
            if (sRate > bestDecadeReliabilityRate) {
              bestDecadeReliabilityRate = sRate;
              bestDecadeReliabilityRegion = r;
              bestDecadeReliabilityDecade = decadeLabels[idx];
            }
          }
        }
      });

      const summary: SpaceLaunchesSummary = {
        totalPayloadTons,
        totalAttempts,
        globalSuccessRate,
        leaderAllTimeRegion,
        leaderAllTimeMassTons,
        leaderAllTimeShare,
        lowestCostPerKg,
        lowestCostRegion,
        lowestCostDecade,
        bestDecadeAvgCostPerKg: bestDecadeAvgCost,
        bestDecadeAvgCostDecade,
        worstDecadeAvgCostPerKg: baselineCost,
        worstDecadeAvgCostDecade,
        costReductionFactor,
        currentDecadeAvgPayloadKg,
        bestDecadeCountryAvgPayloadRegion,
        bestDecadeCountryAvgPayloadDecade,
        bestDecadeCountryAvgPayloadKg,
        baselineAvgPayloadKg,
        worstDecadeAvgPayloadDecade,
        bestDecadeAvgPayloadDecade,
        payloadGrowthFactor,
        reliabilityGrowthFactor,
        worstDecadeReliabilityDecade: worstDecadeLabel,
        worstDecadeReliabilityRate,
        bestDecadeGlobalReliabilityDecade: bestGlobalDecadeLabel,
        bestDecadeGlobalReliabilityRate,
        bestDecadeReliabilityRegion,
        bestDecadeReliabilityRate,
        bestDecadeReliabilityDecade,
      };

      const dataset: SpaceLaunchesDataset = {
        regions: sortedRegions,
        summary,
        payloadCapacity: {
          years: allYears,
          series: capacitySeries,
          launches: annualLaunchSeries,
        },
        decadeCosts: {
          regions: costRegions,
          decades: decadeLabels,
          series: decadeSeries,
          launches: decadeLaunchSeries,
          totalLaunches: decadeTotalLaunches,
          totalAvgCost: decadeTotalAvgCost,
        },
        avgPayload: {
          decades: decadeLabels,
          series: avgPayloadSeries,
          launches: avgPayloadLaunchSeries,
          totalLaunches: avgPayloadTotalLaunches,
          totalAvgPayload: avgPayloadTotalAvg,
        },
        failureRates: {
          decades: decadeLabels,
          series: failureRateSeries,
          attempts: failureAttemptsSeries,
          failures: failureCountsSeries,
          totalAttempts: failureRateTotalAttempts,
          totalFailures: failureRateTotalFailures,
          totalFailureRate: failureRateTotalRate,
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('space-launches');
      logger.success(`Exported space-launches dataset (${allLaunches.length.toLocaleString()} orbital launches, ${allYears[0]}–${allYears[allYears.length - 1]})`);
      return dataset;
    },
    verbose,
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const force = args.includes('-u') || args.includes('--update');
  const verbose = args.includes('-v') || args.includes('--verbose');
  runSpaceLaunchesPipeline(force, verbose).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
