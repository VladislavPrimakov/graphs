/** Time-series dataset for an individual macroeconomic or industrial metric across major powers. */
export interface WorldChartMetricData {
  /** Annual metric values aligned with the years array, keyed by country code, pre-sorted descending by latest value. */
  series: Record<string, (number | null)[]>;
}

/** Individual metric section dataset. */
export interface WorldMetricSectionData {
  years: number[];
  series: Record<string, (number | null)[]>;
  growth: Record<string, (number | null)[]>;
}

/** Section dataset aliases for world dashboard sections. */
export type CleanPowerSectionData = WorldMetricSectionData;
export type ElectricityGenerationSectionData = WorldMetricSectionData;
export type ElectricityPerCapitaSectionData = WorldMetricSectionData;
export type GdpPerCapitaPppSectionData = WorldMetricSectionData;
export type GdpPppSectionData = WorldMetricSectionData;
export type ManufacturingPerCapitaSectionData = WorldMetricSectionData;
export type PassengerCarsSectionData = WorldMetricSectionData;

/** Project-level toolbar metadata and entity catalogue for the World dashboard. */
export interface WorldToolbarMeta {
  minYear: number;
  maxYear: number;
  totalEntities: number;
  entities: string[];
  gdp: Record<string, number>;
  defaultTop: number;
  minTop: number;
  maxTop: number;
}

/** Reactive state for coordinated global economic & energy metric filters. */
export type WorldFilterState = {
  years: [number, number];
  top: number;
  countries: string[];
  mode: 'volume' | 'growth';
};

/** Unified dataset for World Indicators dashboard. */
export interface WorldDataset extends WorldToolbarMeta {
  'gdp-ppp': WorldMetricSectionData;
  'gdp-per-capita-ppp': WorldMetricSectionData;
  'manufacturing-per-capita': WorldMetricSectionData;
  'electricity-generation': WorldMetricSectionData;
  'electricity-per-capita': WorldMetricSectionData;
  'clean-power': WorldMetricSectionData;
  'passenger-cars': WorldMetricSectionData;
}
