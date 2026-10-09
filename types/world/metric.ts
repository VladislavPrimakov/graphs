/** Time-series dataset for an individual macroeconomic or industrial metric across major powers. */
export interface WorldChartMetricData {
  /** Annual metric values aligned with the years array, keyed by country code, pre-sorted descending by latest value. */
  series: Record<string, (number | null)[]>;
}

/** Individual metric section dataset. */
export interface WorldMetricSectionData {
  years: number[];
  series: Record<string, (number | null)[]>;
}
