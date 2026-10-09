/** Summary headline KPIs displayed on the regional inference section. */
export interface AiTokensSummary {
  peakDailyTokens: number;
  peakMonth: string;
  topRegionCode: string;
  topRegionValue: number;
  topRegionShare: number;
}

/** Macro-region time-series data container. */
export interface RegionSeriesItem {
  /** ISO 3166-1 alpha-2 or supranational region code ('CN', 'US', 'EU', 'AEC', 'ROW'). */
  code: string;
  /** Absolute daily inference rate per month in T/day. */
  values: number[];
  /** Regional shares (0–100%) of global token inference. */
  shares: number[];
}

/** Regional token consumption dataset. */
export interface RegionalTokensData {
  /** Monthly time categories formatted as 'YYYY-MM'. */
  months: string[];
  /** Total global daily tokens per month in T/day. */
  total: number[];
  /** Precomputed series per region in display order. */
  series: RegionSeriesItem[];
}

/** Section dataset for tokens-by-region. */
export interface TokensByRegionSectionData {
  summary: AiTokensSummary;
  regions: RegionalTokensData;
}
