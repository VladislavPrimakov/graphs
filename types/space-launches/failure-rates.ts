/** Headline KPI metrics for launch failure rates and reliability. */
export interface FailureRatesSummary {
  /** All-time global launch success rate in percent (0–100). */
  globalSuccessRate: number;
  /** Decade interval of the worst global launch reliability. */
  worstDecadeReliabilityDecade: string;
  /** Success rate in the worst global launch decade in percent (0–100). */
  worstDecadeReliabilityRate: number;
  /** Decade interval of the best global launch reliability. */
  bestDecadeGlobalReliabilityDecade: string;
  /** Success rate in the best global launch decade in percent (0–100). */
  bestDecadeGlobalReliabilityRate: number;
  /** Reliability growth factor from worst decade to best decade. */
  reliabilityGrowthFactor: number;
  /** Region code of the nation with highest single-decade reliability (> 50 launches). */
  bestDecadeReliabilityRegion: string;
  /** Decade label where highest single-decade reliability rate was achieved. */
  bestDecadeReliabilityDecade: string;
  /** Highest single-decade reliability rate in percent (0–100) for a nation with > 50 launches. */
  bestDecadeReliabilityRate: number;
}

/** Historical launch failure rates aggregated by decade. */
export interface FailureRateData {
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Failure rate percentage (0–100) keyed by country/region code. */
  series: Record<string, (number | null)[]>;
  /** Total launch attempts in decade keyed by country/region code. */
  attempts: Record<string, number[]>;
  /** Total failed launches in decade keyed by country/region code. */
  failures: Record<string, number[]>;
  /** Global total orbital launch attempts in decade. */
  totalAttempts: number[];
  /** Global total launch failures in decade. */
  totalFailures: number[];
  /** Global launch failure rate percentage across all nations by decade. */
  totalFailureRate: (number | null)[];
}

/** Section dataset for failure-rates. */
export interface FailureRatesSectionData {
  regions: string[];
  summary: FailureRatesSummary;
  failureRates: FailureRateData;
}
