/** Headline KPI metrics for average payload to orbit. */
export interface AvgPayloadSummary {
  /** Decade interval of the highest historical average payload per launch. */
  bestDecadeAvgPayloadDecade: string;
  /** Global average payload delivered per launch in 2020s (kg). */
  currentDecadeAvgPayloadKg: number;
  /** Decade interval of the lowest historical average payload per launch. */
  worstDecadeAvgPayloadDecade: string;
  /** Global average payload delivered per launch in 1950s baseline (kg). */
  baselineAvgPayloadKg: number;
  /** Average payload mass growth factor from 1950s to 2020s. */
  payloadGrowthFactor: number;
  /** Region code of the nation holding the single-decade average payload record. */
  bestDecadeCountryAvgPayloadRegion: string;
  /** Decade interval of the single-decade nation average payload record. */
  bestDecadeCountryAvgPayloadDecade: string;
  /** Highest single-decade nation average payload delivered per launch (kg). */
  bestDecadeCountryAvgPayloadKg: number;
}

/** Historical average payload mass delivered to orbit per launch attempt aggregated by decade. */
export interface AvgPayloadData {
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Estimated average kg delivered per launch attempt keyed by country/region code. */
  series: Record<string, (number | null)[]>;
  /** Total launches in decade keyed by country/region code. */
  launches: Record<string, number[]>;
  /** Global total orbital launches in decade across all spacefaring nations. */
  totalLaunches: number[];
  /** Global average payload mass delivered per launch attempt in kg across all nations by decade. */
  totalAvgPayload: (number | null)[];
}

/** Section dataset for avg-payload. */
export interface AvgPayloadSectionData {
  regions: string[];
  summary: AvgPayloadSummary;
  avgPayload: AvgPayloadData;
}
