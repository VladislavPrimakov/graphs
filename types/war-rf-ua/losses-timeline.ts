import type { WarLossCategory } from './categories';
import type { LossSummaryData } from './category-losses';

/** Category loss tally for a single timeline month in tooltip breakdown tables. */
export interface LossTimelineBreakdownItem {
  /** Weapon category identifier. */
  category: WarLossCategory;
  /** Verified Russian losses for the period (units). */
  rf: number;
  /** Verified Ukrainian losses for the period (units). */
  ua: number;
}

/** Timeline chart data point embedding a detailed multi-category loss breakdown. */
export interface LossTimelineDataPoint {
  /** Total monthly loss count for the series (units). */
  value: number;
  /** Breakdown of losses by weapon category for interactive tooltip inspection. */
  breakdown?: LossTimelineBreakdownItem[];
}

/** Structured timeline data arrays spanning February 2022 to the current period. */
export interface LossOverallTimelineData {
  /** Monthly Russian loss series (units). */
  rf: number[];
  /** Monthly Ukrainian loss series (units). */
  ua: number[];
  /** Monthly breakdown list across weapon categories for interactive tooltips. */
  breakdowns: LossTimelineBreakdownItem[][];
}

/** Section dataset for losses-timeline. */
export interface LossesTimelineSectionData {
  periods: string[];
  overallTimeline: LossOverallTimelineData;
  summary: LossSummaryData;
}
