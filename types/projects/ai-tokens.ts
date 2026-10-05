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

/** Canonical machine identifiers for tracked AI model and inference providers. */
export const AI_COMPANY_IDS = ['doubao', 'google', 'openai', 'anthropic', 'fireworks', 'microsoft', 'deepseek', 'together'] as const;

/** Canonical AI model and inference provider identifier. */
export type AiCompanyId = (typeof AI_COMPANY_IDS)[number];

/** Company throughput time-series data container. */
export interface CompanySeriesItem {
  /** Tracked AI model provider identifier. */
  id: AiCompanyId;
  /** Monthly throughput values per company in T/day. */
  values: number[];
  /** Company shares (0–100%) of total company throughput. */
  shares: number[];
}

/** Company inference metrics across the monthly timeline. */
export interface CompanyTokensData {
  /** Monthly time categories formatted as 'YYYY-MM'. */
  months: string[];
  /** Total tracked daily tokens across all providers per month in T/day. */
  total: number[];
  /** Precomputed series per company in display order. */
  series: CompanySeriesItem[];
}

/** Static root JSON dataset structure for AI token consumption analytics. */
export interface AiTokensDataset {
  /** Summary headline KPIs displayed on the regional inference section. */
  summary: {
    peakDailyTokens: number;
    peakMonth: string;
    topRegionCode: string;
    topRegionValue: number;
    topRegionShare: number;
  };
  /** Regional breakdown time-series. */
  regions: RegionalTokensData;
  /** Company/provider breakdown time-series. */
  companies: CompanyTokensData;
}
