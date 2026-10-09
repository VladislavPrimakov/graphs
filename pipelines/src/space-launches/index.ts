import type { AvgPayloadSectionData } from '@graphs/types/space-launches/avg-payload';
import type { FailureRatesSectionData } from '@graphs/types/space-launches/failure-rates';
import type { LaunchCostsSectionData } from '@graphs/types/space-launches/launch-costs';
import type { PayloadCapacitySectionData } from '@graphs/types/space-launches/payload-capacity';
import { exportProjectSections, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchWithRetry } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { percentage, percentageNullable, range, ratio, round, sum } from '@/utils/math';
import { resolveRegionCode } from '@/utils/region';

const DATA_FILE = getPipelineDataPath('space-launches');

const API_HOST = 'll.thespacedevs.com';
const API_VERSION = '2.3.0';
const CURRENT_YEAR = new Date().getFullYear();

interface SpaceLaunchesPipelineCache {
  meta?: {
    lastLaunchId?: string;
    lastLaunchNet?: string;
    remoteCount?: number;
  };
  launches: StoredLaunch[];
  sections: {
    'payload-capacity': PayloadCapacitySectionData;
    'avg-payload': AvgPayloadSectionData;
    'launch-costs': LaunchCostsSectionData;
    'failure-rates': FailureRatesSectionData;
  };
}

/** Exports section datasets for space-launches. */
async function exportSpaceLaunches(sections: SpaceLaunchesPipelineCache['sections']): Promise<void> {
  await exportProjectSections('space-launches', sections);
}

interface StoredLaunch {
  id: string;
  year: number;
  net: string;
  leo_kg: number;
  cost: number | null;
  region: string;
  status: number;
  country?: string;
  rocket?: string;
}

interface LaunchRegionInput {
  country?: string;
  rocket?: string;
  leo_kg?: number;
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
function resolveLaunchRegion(launch: LaunchRegionInput): string {
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
export async function runSpaceLaunchesPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'space-launches',
    async () => {
      const logger = getLogger();
      logger.start('Starting Space Launches ETL pipeline');

      let cache: SpaceLaunchesPipelineCache | null = null;
      if (await fileExists(DATA_FILE)) {
        try {
          cache = await readJson<SpaceLaunchesPipelineCache>(DATA_FILE);
        } catch {
          logger.warn('Could not read existing data.json file');
        }
      }

      const launchesById = new Map<string, StoredLaunch>();
      if (cache?.launches) {
        for (const l of cache.launches) {
          if (l?.id && (l.status === 3 || l.status === 4 || l.status === 7)) {
            const region = l.region || resolveLaunchRegion(l);
            launchesById.set(l.id, {
              id: l.id,
              year: l.year,
              net: l.net,
              leo_kg: l.leo_kg,
              cost: l.cost,
              region,
              status: l.status,
            });
          }
        }
        logger.debug(`Loaded existing database (${launchesById.size} launches)`);
      }

      const hasValidDataset = Boolean(cache?.launches?.length) && Boolean(cache?.sections?.['payload-capacity']?.summary?.totalAttempts);
      let preflightCount: number | null = null;
      let latestRemoteLaunch: ApiLaunchResult | null = null;

      // Smart pre-flight check: verify latest launch from Space Devs API via lightweight limit=1 call
      if (!forceUpdate && hasValidDataset && cache?.meta?.lastLaunchId) {
        logger.debug('Checking Space Devs API for recent launches via lightweight pre-flight...');
        try {
          const preflightUrl = `https://${API_HOST}/${API_VERSION}/launches/previous/?limit=1`;
          const res = await fetchWithRetry(preflightUrl, { retries: 2, timeoutMs: 15000 });
          if (res.ok) {
            const data = (await res.json()) as { count?: number; results?: ApiLaunchResult[] };
            preflightCount = data.count ?? null;
            latestRemoteLaunch = data.results?.[0] ?? null;

            if (latestRemoteLaunch?.id === cache.meta.lastLaunchId && preflightCount === cache.meta.remoteCount) {
              logger.info(`Remote sources unchanged (${cache.launches.length.toLocaleString()} launches up to ${latestRemoteLaunch?.net?.slice(0, 10)}). Using cached dataset.`);
              await exportSpaceLaunches(cache.sections);
              return;
            }
            logger.info('New upstream data detected. Fetching recent launches...');
          } else {
            logger.warn(`Space Devs API preflight returned HTTP ${res.status}. Using cached dataset.`);
            await exportSpaceLaunches(cache.sections);
            return;
          }
        } catch (err) {
          logger.warn(`Space Devs API unreachable (${err}). Using cached dataset.`);
          await exportSpaceLaunches(cache.sections);
          return;
        }
      }

      logger.debug('Fetching recent orbital launches from Space Devs API...');
      const newLaunchesFetched: ApiLaunchResult[] = [];
      let nextUrl: string | null = `https://${API_HOST}/${API_VERSION}/launches/previous/?limit=100&mode=detailed`;
      let pagesFetched = 0;
      const MAX_PAGES = 5;

      while (nextUrl && pagesFetched < MAX_PAGES) {
        try {
          const res = await fetchWithRetry(nextUrl, { retries: 2, timeoutMs: 25000 });
          if (!res.ok) {
            logger.warn(`Space Devs API returned HTTP ${res.status}`);
            break;
          }
          const data = (await res.json()) as { count?: number; next?: string | null; results?: ApiLaunchResult[] };
          if (preflightCount == null && data.count != null) {
            preflightCount = data.count;
          }
          const results = data.results || [];
          if (results.length === 0) break;

          let hitKnown = false;
          for (const l of results) {
            if (launchesById.has(l.id)) {
              hitKnown = true;
            }
            newLaunchesFetched.push(l);
          }

          pagesFetched++;
          if (hitKnown || !data.next) {
            break;
          }
          nextUrl = data.next;
        } catch (err) {
          logger.warn(`Error querying Space Devs API page ${pagesFetched + 1}: ${err}`);
          break;
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
        if (Number.isNaN(launchYear) || launchYear > CURRENT_YEAR) continue;

        const payloadKg = extractPayloadKg(launch.rocket?.configuration);
        const costVal = launch.rocket?.configuration?.launch_cost != null ? parseFloat(String(launch.rocket.configuration.launch_cost)) : null;
        const launchCost = costVal != null && !Number.isNaN(costVal) && costVal > 0 ? costVal : null;
        const countryCode = launch.pad?.location?.country?.alpha_3_code || launch.pad?.country?.alpha_3_code || launch.launch_service_provider?.country_code || '';
        const rName = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '';

        if (!launchesById.has(launch.id)) {
          addedCount++;
        }

        const region = resolveLaunchRegion({ country: countryCode, rocket: rName, leo_kg: payloadKg });

        launchesById.set(launch.id, {
          id: launch.id,
          year: launchYear,
          net: launch.net.slice(0, 10),
          leo_kg: payloadKg,
          cost: launchCost,
          region,
          status,
        });
      }

      if (addedCount > 0) {
        logger.info(`Merged ${addedCount} new launches into database (total ${launchesById.size})`);
      }

      const allLaunches = Array.from(launchesById.values());
      const allSorted = [...allLaunches].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.net.localeCompare(b.net);
      });

      if (allSorted.length === 0) {
        throw new Error('No launch data available to process');
      }

      // Determine chronological bounds
      let minYear = Infinity;
      let maxYear = -Infinity;

      for (const item of allSorted) {
        if (item.year < minYear) minYear = item.year;
        if (item.year > maxYear) maxYear = item.year;
      }

      if (minYear === Infinity) {
        throw new Error('No launch data available to process');
      }

      const allYears = range(minYear, maxYear);

      // Compute total delivered mass per entity across all successful launches to sort them
      const entityTotalMass = new Map<string, number>();
      for (const item of allLaunches) {
        if (item.status === 3) {
          const r = item.region;
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
        const r = item.region;
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
              return round(stat.sum / stat.count, 0);
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
        return count > 0 ? round(sum / count, 0) : null;
      });

      // 2. Annual Capacity
      const capacitySeries: Record<string, number[]> = {};
      const annualLaunchSeries: Record<string, number[]> = {};

      for (const r of sortedRegions) {
        capacitySeries[r] = allYears.map((y) => round(capacityMatrix[r][y], 1));
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
            return round(totalKg / count, 0);
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
        return count > 0 ? round(mass / count, 0) : null;
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
            return percentage(fails, attempts, 1);
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
        return percentageNullable(fails, attempts, 1);
      });

      // Precomputed Macro Summary KPIs
      let totalPayloadTons = 0;
      for (const series of Object.values(capacitySeries)) {
        for (const val of series) {
          totalPayloadTons += val;
        }
      }
      totalPayloadTons = round(totalPayloadTons, 0);

      let maxRegionAllTimeMass = 0;
      let leaderAllTimeRegion = '';
      for (const [r, series] of Object.entries(capacitySeries)) {
        const seriesSum = sum(series);
        if (seriesSum > maxRegionAllTimeMass) {
          maxRegionAllTimeMass = seriesSum;
          leaderAllTimeRegion = r;
        }
      }
      const leaderAllTimeMassTons = round(maxRegionAllTimeMass, 0);
      const leaderAllTimeShare = percentage(leaderAllTimeMassTons, totalPayloadTons, 1);

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
          const avgCost = round(weightedCostSum / launchSum, 0);
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
      const costReductionFactor = ratio(baselineCost, bestDecadeAvgCost, 1, 0) ?? 0;

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

      const baselineAvgPayloadKg = minDecadeAvgPayload < Number.POSITIVE_INFINITY ? round(minDecadeAvgPayload, 0) : 0;
      const currentDecadeAvgPayloadKg = maxDecadeAvgPayload > 0 ? round(maxDecadeAvgPayload, 0) : 0;
      const payloadGrowthFactor = ratio(currentDecadeAvgPayloadKg, baselineAvgPayloadKg, 1, 0) ?? 0;

      let totalAttempts = 0;
      let totalFailures = 0;

      for (const r of sortedRegions) {
        const atts = failureAttemptsSeries[r] || [];
        const fails = failureCountsSeries[r] || [];
        totalAttempts += sum(atts);
        totalFailures += sum(fails);
      }

      const globalSuccessRate = percentage(totalAttempts - totalFailures, totalAttempts, 1);

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
      const reliabilityGrowthFactor = minDecadeSuccessRate > 0 && minDecadeSuccessRate < Number.POSITIVE_INFINITY ? (ratio(maxDecadeSuccessRate, minDecadeSuccessRate, 1) ?? 1) : 1;
      const worstDecadeReliabilityRate = minDecadeSuccessRate < Number.POSITIVE_INFINITY ? round(minDecadeSuccessRate, 1) : 0;
      const bestDecadeGlobalReliabilityRate = maxDecadeSuccessRate > Number.NEGATIVE_INFINITY ? round(maxDecadeSuccessRate, 1) : 0;

      // Best nation reliability in a single decade with > 50 attempts
      let bestDecadeReliabilityRegion = '';
      let bestDecadeReliabilityRate = 0;
      let bestDecadeReliabilityDecade = '';

      sortedDecades.forEach((_d, idx) => {
        for (const r of sortedRegions) {
          const atts = failureAttemptsSeries[r]?.[idx] || 0;
          const fails = failureCountsSeries[r]?.[idx] || 0;
          if (atts > 50) {
            const sRate = percentage(atts - fails, atts, 1);
            if (sRate > bestDecadeReliabilityRate) {
              bestDecadeReliabilityRate = sRate;
              bestDecadeReliabilityRegion = r;
              bestDecadeReliabilityDecade = decadeLabels[idx];
            }
          }
        }
      });

      const payloadCapacitySectionData: PayloadCapacitySectionData = {
        regions: sortedRegions,
        summary: {
          totalPayloadTons,
          totalAttempts: allLaunches.length,
          leaderAllTimeRegion,
          leaderAllTimeMassTons,
          leaderAllTimeShare,
        },
        payloadCapacity: {
          years: allYears,
          series: capacitySeries,
          launches: annualLaunchSeries,
        },
      };

      const avgPayloadSectionData: AvgPayloadSectionData = {
        regions: sortedRegions,
        summary: {
          bestDecadeAvgPayloadDecade,
          currentDecadeAvgPayloadKg,
          worstDecadeAvgPayloadDecade,
          baselineAvgPayloadKg,
          payloadGrowthFactor,
          bestDecadeCountryAvgPayloadRegion,
          bestDecadeCountryAvgPayloadDecade,
          bestDecadeCountryAvgPayloadKg,
        },
        avgPayload: {
          decades: decadeLabels,
          series: avgPayloadSeries,
          launches: avgPayloadLaunchSeries,
          totalLaunches: avgPayloadTotalLaunches,
          totalAvgPayload: avgPayloadTotalAvg,
        },
      };

      const launchCostsSectionData: LaunchCostsSectionData = {
        summary: {
          bestDecadeAvgCostDecade,
          bestDecadeAvgCostPerKg: bestDecadeAvgCost,
          worstDecadeAvgCostDecade,
          worstDecadeAvgCostPerKg: baselineCost,
          costReductionFactor,
          lowestCostRegion,
          lowestCostDecade,
          lowestCostPerKg,
        },
        decadeCosts: {
          regions: costRegions,
          decades: decadeLabels,
          series: decadeSeries,
          launches: decadeLaunchSeries,
          totalLaunches: decadeTotalLaunches,
          totalAvgCost: decadeTotalAvgCost,
        },
      };

      const failureRatesSectionData: FailureRatesSectionData = {
        regions: sortedRegions,
        summary: {
          globalSuccessRate,
          worstDecadeReliabilityDecade: worstDecadeLabel,
          worstDecadeReliabilityRate,
          bestDecadeGlobalReliabilityDecade: bestGlobalDecadeLabel,
          bestDecadeGlobalReliabilityRate,
          reliabilityGrowthFactor,
          bestDecadeReliabilityRegion,
          bestDecadeReliabilityDecade,
          bestDecadeReliabilityRate,
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

      const sections = {
        'payload-capacity': payloadCapacitySectionData,
        'avg-payload': avgPayloadSectionData,
        'launch-costs': launchCostsSectionData,
        'failure-rates': failureRatesSectionData,
      };

      const latestLaunch = allSorted[allSorted.length - 1];
      const newMeta = {
        lastLaunchId: latestRemoteLaunch?.id || latestLaunch?.id || cache?.meta?.lastLaunchId,
        lastLaunchNet: latestRemoteLaunch?.net || latestLaunch?.net || cache?.meta?.lastLaunchNet,
        remoteCount: preflightCount ?? cache?.meta?.remoteCount ?? allSorted.length,
      };

      await writeJson(
        DATA_FILE,
        {
          meta: newMeta,
          launches: allSorted,
          sections,
        },
        0,
      );
      await exportSpaceLaunches(sections);
      logger.success(`Exported space-launches datasets (${allLaunches.length.toLocaleString()} launches, ${allYears[0]}–${allYears[allYears.length - 1]})`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runSpaceLaunchesPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('space-launches').error('Fatal error running Space Launches pipeline:', err);
    process.exit(1);
  });
}
