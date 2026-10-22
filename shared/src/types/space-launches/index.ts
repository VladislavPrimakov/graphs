/** Metadata for a single space-faring country/power in the toolbar. */
export interface SpaceEntityMeta {
  code: string;
  launches: number;
}

/** Project-level toolbar metadata for the Space Launches dashboard. */
export interface SpaceLaunchesToolbarMeta {
  totalLaunches: number;
  entities: SpaceEntityMeta[];
}

/** Reactive store state for the coordinated space launches toolbar. */
export type SpaceLaunchesFilterState = {
  countries: string[];
};

/** Headline KPI metrics for payload capacity to orbit. */
export interface PayloadCapacitySummary {
  totalPayloadTons: number;
  totalAttempts: number;
  leaderAllTimeRegion: string;
  leaderAllTimeMassTons: number;
  leaderAllTimeShare: number;
}

/** Historical annual mass of orbital launch payload capacity delivered by spacefaring nations. */
export interface PayloadCapacityData {
  years: number[];
  series: Record<string, number[]>;
  launches: Record<string, number[]>;
}

/** Headline KPI metrics for average payload to orbit. */
export interface AvgPayloadSummary {
  bestDecadeAvgPayloadDecade: string;
  currentDecadeAvgPayloadKg: number;
  worstDecadeAvgPayloadDecade: string;
  baselineAvgPayloadKg: number;
  payloadGrowthFactor: number;
  bestDecadeCountryAvgPayloadRegion: string;
  bestDecadeCountryAvgPayloadDecade: string;
  bestDecadeCountryAvgPayloadKg: number;
}

/** Historical average payload mass delivered to orbit per launch attempt aggregated by decade. */
export interface AvgPayloadData {
  decades: string[];
  series: Record<string, (number | null)[]>;
  launches: Record<string, number[]>;
  totalLaunches: number[];
  totalAvgPayload: (number | null)[];
}

/** Headline KPI metrics for launch failure rates and reliability. */
export interface FailureRatesSummary {
  globalSuccessRate: number;
  worstDecadeReliabilityDecade: string;
  worstDecadeReliabilityRate: number;
  bestDecadeGlobalReliabilityDecade: string;
  bestDecadeGlobalReliabilityRate: number;
  reliabilityGrowthFactor: number;
  bestDecadeReliabilityRegion: string;
  bestDecadeReliabilityDecade: string;
  bestDecadeReliabilityRate: number;
}

/** Historical launch failure rates aggregated by decade. */
export interface FailureRateData {
  decades: string[];
  series: Record<string, (number | null)[]>;
  attempts: Record<string, number[]>;
  failures: Record<string, number[]>;
  totalAttempts: number[];
  totalFailures: number[];
  totalFailureRate: (number | null)[];
}

/** Headline KPI metrics for launch costs to LEO. */
export interface LaunchCostsSummary {
  bestDecadeAvgCostDecade: string;
  bestDecadeAvgCostPerKg: number;
  worstDecadeAvgCostDecade: string;
  worstDecadeAvgCostPerKg: number;
  costReductionFactor: number;
  lowestCostRegion: string;
  lowestCostDecade: string;
  lowestCostPerKg: number;
}

/** Historical launch costs per kg to LEO aggregated by decade. */
export interface DecadeCostsData {
  regions: string[];
  decades: string[];
  series: Record<string, (number | null)[]>;
  launches: Record<string, number[]>;
  totalLaunches: number[];
  totalAvgCost: (number | null)[];
}

export interface PayloadCapacitySectionData {
  regions: string[];
  summary: PayloadCapacitySummary;
  payloadCapacity: PayloadCapacityData;
}

export interface AvgPayloadSectionData {
  regions: string[];
  summary: AvgPayloadSummary;
  avgPayload: AvgPayloadData;
}

export interface FailureRatesSectionData {
  regions: string[];
  summary: FailureRatesSummary;
  failureRates: FailureRateData;
}

export interface LaunchCostsSectionData {
  summary: LaunchCostsSummary;
  decadeCosts: DecadeCostsData;
}

/** Unified dataset for the orbital space launches dashboard. */
export interface SpaceLaunchesDataset extends SpaceLaunchesToolbarMeta {
  'payload-capacity': PayloadCapacitySectionData;
  'avg-payload': AvgPayloadSectionData;
  'failure-rates': FailureRatesSectionData;
  'launch-costs': LaunchCostsSectionData;
}
