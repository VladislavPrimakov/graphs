import type { AiTokensSummary } from './tokens-by-region';

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

/** Section dataset for tokens-by-company. */
export interface TokensByCompanySectionData {
  summary: AiTokensSummary;
  companies: CompanyTokensData;
}
