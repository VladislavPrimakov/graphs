import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '@/utils/http';
import { getLogger } from '@/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CountryEntry {
  /** 2-letter ISO-2 lowercase code used as project identifier and route slug: e.g. "us", "cn", "de", "ua" */
  code: string;
  /** 3-letter ISO-3 uppercase code used for IMF DataMapper queries: e.g. "USA", "CHN", "DEU", "UKR" */
  iso3: string;
  /** UN Comtrade numeric reporter ID used for Comtrade API queries: e.g. 842, 156, 276, 804 */
  id: number;
  /** Latest nominal GDP in billion USD from IMF DataMapper (for tooltips and selector counters) */
  gdp?: number;
}

interface ComtradeReporterRow {
  id: number;
  reporterCodeIsoAlpha2?: string;
  reporterCodeIsoAlpha3?: string;
  entryExpiredDate?: string;
}

interface ImfGdpResponse {
  values?: {
    NGDPD?: Record<string, Record<string, number>>;
  };
}

/**
 * Fetches active reporters from UN Comtrade and countries from IMF DataMapper,
 * computes their strict 192-country intersection, sorts by GDP descending,
 * and writes a compact minified single-line countries.json.
 */
export async function generateCountriesList(outputPath = path.join(__dirname, 'countries.json')): Promise<CountryEntry[]> {
  const logger = getLogger('country');
  logger.start('Fetching UN Comtrade active reporters and IMF DataMapper WEO countries...');

  // 1. Fetch UN Comtrade active reporters
  const comtradeUrl = 'https://comtradeapi.un.org/files/v1/app/reference/Reporters.json';
  const comtradeRes = await fetchWithRetry(comtradeUrl, { retries: 3, timeoutMs: 30000 });
  if (!comtradeRes.ok) {
    throw new Error(`Failed to fetch Comtrade reporters: HTTP ${comtradeRes.status}`);
  }
  const comtradeJson = (await comtradeRes.json()) as { results?: ComtradeReporterRow[] };
  const comtradeMap = new Map<string, ComtradeReporterRow>();

  for (const r of comtradeJson.results || []) {
    const iso3 = r.reporterCodeIsoAlpha3?.trim().toUpperCase();
    const iso2 = r.reporterCodeIsoAlpha2?.trim().toUpperCase();
    if (iso3 && iso3.length === 3 && iso2 && iso2.length === 2 && !r.entryExpiredDate) {
      comtradeMap.set(iso3, r);
    }
  }
  logger.info(`Found ${comtradeMap.size} active UN Comtrade reporters with valid ISO-2/ISO-3.`);

  // 2. Fetch IMF DataMapper nominal GDP indicators
  const imfUrl = 'https://www.imf.org/external/datamapper/api/v1/NGDPD';
  const imfRes = await fetchWithRetry(imfUrl, { retries: 3, timeoutMs: 30000 });
  if (!imfRes.ok) {
    throw new Error(`Failed to fetch IMF DataMapper: HTTP ${imfRes.status}`);
  }
  const imfJson = (await imfRes.json()) as ImfGdpResponse;
  const imfGdpMap = imfJson.values?.NGDPD || {};

  // 3. Compute intersection and rank by latest nominal GDP
  const currentYear = new Date().getFullYear();
  const candidateYears = [String(currentYear), String(currentYear - 1), String(currentYear - 2), '2024', '2023'];

  const ranked: Array<{ entry: CountryEntry; gdp: number }> = [];

  for (const [iso3, reporter] of comtradeMap.entries()) {
    if (iso3 in imfGdpMap) {
      const iso2 = reporter.reporterCodeIsoAlpha2?.trim().toUpperCase() || '';
      const gdpByYear = imfGdpMap[iso3] || {};
      let latestGdp = 0;
      for (const y of candidateYears) {
        if (typeof gdpByYear[y] === 'number') {
          latestGdp = gdpByYear[y];
          break;
        }
      }

      ranked.push({
        entry: {
          code: iso2.toLowerCase(),
          iso3,
          id: reporter.id,
          gdp: latestGdp ? Math.round(latestGdp * 10) / 10 : undefined,
        },
        gdp: latestGdp,
      });
    }
  }

  // 4. Sort by nominal GDP descending (richest economies first)
  ranked.sort((a, b) => b.gdp - a.gdp);

  const countries = ranked.map((r) => r.entry);

  // 5. Write minified single-line JSON
  await Bun.write(outputPath, JSON.stringify(countries));

  logger.success(`Successfully generated ${countries.length} countries (minified 1-line) -> ${outputPath}`);
  return countries;
}

if (import.meta.main) {
  generateCountriesList().catch((err) => {
    getLogger('country').error('Failed to generate countries list:', err);
    process.exit(1);
  });
}
