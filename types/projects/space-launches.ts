/** Historical annual mass of orbital launch payload capacity delivered by spacefaring nations. */
export interface PayloadCapacityData {
  /** 4-digit calendar launch years from 1958 to present. */
  years: number[];
  /** Annual delivered payload capacity keyed by country/region code in metric tons to LEO/SSO. */
  series: Record<string, number[]>;
  /** Annual launch counts keyed by country/region code. */
  launches: Record<string, number[]>;
}

/** Historical launch cost trends aggregated by decade in constant 2021 USD. */
export interface DecadeCostsData {
  /** List of spacefaring regions with historical cost estimates. */
  regions: string[];
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Estimated average launch cost to low Earth orbit keyed by country/region code in constant 2021 USD/kg. */
  series: Record<string, (number | null)[]>;
  /** Total launches in decade keyed by country/region code. */
  launches: Record<string, number[]>;
  /** Global launch counts in decade across regions with cost estimates. */
  totalLaunches: number[];
  /** Global weighted average launch cost per kg across all nations by decade in constant 2021 USD/kg. */
  totalAvgCost: (number | null)[];
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

/** Historical launch reliability and failure rates aggregated by decade. */
export interface FailureRateData {
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Share of failed and partial-failure attempts in percent (0–100) keyed by country/region code. */
  series: Record<string, (number | null)[]>;
  /** Total orbital attempts in decade keyed by country/region code. */
  attempts: Record<string, number[]>;
  /** Failed orbital attempts in decade keyed by country/region code. */
  failures: Record<string, number[]>;
  /** Global total orbital launch attempts in decade across all nations. */
  totalAttempts: number[];
  /** Global failed orbital launch attempts in decade across all nations. */
  totalFailures: number[];
  /** Global orbital launch failure rate in percent (0–100) across all nations by decade. */
  totalFailureRate: (number | null)[];
}

/** Precomputed macro summary metrics for space launches and economics. */
export interface SpaceLaunchesSummary {
  /** Total payload capacity delivered to orbit in metric tons (all-time). */
  totalPayloadTons: number;
  /** Total orbital launch attempts across all tracked history. */
  totalAttempts: number;
  /** All-time global launch success rate in percent (0–100). */
  globalSuccessRate: number;
  /** Region code of the all-time leader in delivered payload mass. */
  leaderAllTimeRegion: string;
  /** All-time delivered payload mass by the leader nation in metric tons. */
  leaderAllTimeMassTons: number;
  /** Percentage share of all-time payload delivered by the leader nation. */
  leaderAllTimeShare: number;
  /** Lowest estimated average cost per kg in constant USD (2020s). */
  lowestCostPerKg: number;
  /** Region code of the spacefaring nation with the lowest estimated launch cost. */
  lowestCostRegion: string;
  /** Decade interval where lowest launch cost was achieved. */
  lowestCostDecade: string;
  /** Global weighted average launch cost per kg in the best decade (2020s). */
  bestDecadeAvgCostPerKg: number;
  /** Decade interval of the best global average launch cost (e.g. '2020s'). */
  bestDecadeAvgCostDecade: string;
  /** Global weighted average launch cost per kg in the worst/baseline decade (1950s). */
  worstDecadeAvgCostPerKg: number;
  /** Decade interval of the worst global average launch cost (e.g. '1950s'). */
  worstDecadeAvgCostDecade: string;
  /** Cost reduction factor from baseline to lowest. */
  costReductionFactor: number;
  /** Global average payload delivered per launch in 2020s (kg). */
  currentDecadeAvgPayloadKg: number;
  /** Region code of the nation holding the single-decade average payload record. */
  bestDecadeCountryAvgPayloadRegion: string;
  /** Decade interval of the single-decade nation average payload record. */
  bestDecadeCountryAvgPayloadDecade: string;
  /** Highest single-decade nation average payload delivered per launch (kg). */
  bestDecadeCountryAvgPayloadKg: number;
  /** Global average payload delivered per launch in 1950s baseline (kg). */
  baselineAvgPayloadKg: number;
  /** Decade interval of the lowest historical average payload per launch. */
  worstDecadeAvgPayloadDecade: string;
  /** Decade interval of the highest historical average payload per launch. */
  bestDecadeAvgPayloadDecade: string;
  /** Average payload mass growth factor from 1950s to 2020s. */
  payloadGrowthFactor: number;
  /** Reliability growth factor from worst decade to best decade. */
  reliabilityGrowthFactor: number;
  /** Decade interval of the worst global launch reliability. */
  worstDecadeReliabilityDecade: string;
  /** Success rate in the worst global launch decade in percent (0–100). */
  worstDecadeReliabilityRate: number;
  /** Decade interval of the best global launch reliability. */
  bestDecadeGlobalReliabilityDecade: string;
  /** Success rate in the best global launch decade in percent (0–100). */
  bestDecadeGlobalReliabilityRate: number;
  /** Region code of the nation with highest single-decade reliability (> 50 launches). */
  bestDecadeReliabilityRegion: string;
  /** Highest single-decade reliability rate in percent (0–100) for a nation with > 50 launches. */
  bestDecadeReliabilityRate: number;
  /** Decade label where highest single-decade reliability rate was achieved. */
  bestDecadeReliabilityDecade: string;
}

/** Static root JSON dataset structure for historical space launches and economics. */
export interface SpaceLaunchesDataset {
  /** List of tracked spacefaring regions ordered by cumulative payload mass. */
  regions: string[];
  /** Precomputed macro summary metrics for KPI cards. */
  summary: SpaceLaunchesSummary;
  /** Annual delivered orbital payload capacity time-series. */
  payloadCapacity: PayloadCapacityData;
  /** Decade-level inflation-adjusted launch cost estimates per kg. */
  decadeCosts: DecadeCostsData;
  /** Decade-level average payload mass delivered per launch in kilograms. */
  avgPayload: AvgPayloadData;
  /** Decade-level launch failure rate and reliability statistics. */
  failureRates: FailureRateData;
}
