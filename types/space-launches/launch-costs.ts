/** Headline KPI metrics for launch costs to LEO. */
export interface LaunchCostsSummary {
  /** Decade interval of the best global average launch cost (e.g. '2020s'). */
  bestDecadeAvgCostDecade: string;
  /** Global weighted average launch cost per kg in the best decade (2020s). */
  bestDecadeAvgCostPerKg: number;
  /** Decade interval of the worst global average launch cost (e.g. '1950s'). */
  worstDecadeAvgCostDecade: string;
  /** Global weighted average launch cost per kg in the worst/baseline decade (1950s). */
  worstDecadeAvgCostPerKg: number;
  /** Cost reduction factor from baseline to lowest. */
  costReductionFactor: number;
  /** Region code of the spacefaring nation with the lowest estimated launch cost. */
  lowestCostRegion: string;
  /** Decade interval where lowest launch cost was achieved. */
  lowestCostDecade: string;
  /** Lowest estimated average cost per kg in constant USD (2020s). */
  lowestCostPerKg: number;
}

/** Historical launch costs per kg to LEO aggregated by decade. */
export interface DecadeCostsData {
  /** Tracked spacefaring regions. */
  regions: string[];
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Estimated average cost per kg keyed by country/region code in constant 2020 USD. */
  series: Record<string, (number | null)[]>;
  /** Total launches in decade keyed by country/region code. */
  launches: Record<string, number[]>;
  /** Global total orbital launches in decade across all spacefaring nations. */
  totalLaunches: number[];
  /** Global weighted average cost per kg delivered to LEO across all nations by decade. */
  totalAvgCost: (number | null)[];
}

/** Section dataset for launch-costs. */
export interface LaunchCostsSectionData {
  summary: LaunchCostsSummary;
  decadeCosts: DecadeCostsData;
}
