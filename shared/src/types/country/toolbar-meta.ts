import type { TradeCategoryId } from './profile';

/** Project-level toolbar metadata for the country dashboard. */
export interface CountryToolbarMeta {
  /** Available ISO-2 country codes in lowercase (sorted by GDP descending). */
  countries: string[];
  /** Latest nominal GDP in billion USD per country code (for tooltips and selector counters). */
  gdp: Record<string, number>;
  /** Minimum calendar year available in dataset (e.g. 1990). */
  minYear: number;
  /** Maximum calendar year available in dataset (e.g. 2025). */
  maxYear: number;
  /** Default 6-year period tuple [maxYear - 5, maxYear]. */
  defaultPeriod: [startYear: number, endYear: number];
  /** Precomputed structural grouping of detailed codes under each macro category. */
  categories: Record<TradeCategoryId, string[]>;
}
