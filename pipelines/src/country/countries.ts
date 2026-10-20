import countriesData from './countries.json';

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

/** Complete list of 192 sovereign countries present in both UN Comtrade and IMF DataMapper, sorted by GDP descending. */
export const COUNTRIES: CountryEntry[] = countriesData as CountryEntry[];

/** Lowercase 2-letter ISO-2 codes for all 192 supported countries. */
export const SUPPORTED_COUNTRIES: string[] = COUNTRIES.map((c) => c.code);

/** Map from lowercase 2-letter code (e.g. "us") to CountryEntry. */
export const COUNTRY_BY_CODE: Map<string, CountryEntry> = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Map from uppercase 3-letter ISO-3 (e.g. "USA") to CountryEntry. */
export const COUNTRY_BY_ISO3: Map<string, CountryEntry> = new Map(COUNTRIES.map((c) => [c.iso3, c]));

/** Map from numeric UN Comtrade ID (e.g. 842) to CountryEntry. */
export const COUNTRY_BY_ID: Map<number, CountryEntry> = new Map(COUNTRIES.map((c) => [c.id, c]));
