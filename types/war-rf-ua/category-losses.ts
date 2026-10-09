import type { WarLossCategory } from './categories';

/** Equipment loss tally and comparative ratio for a specific weapon category. */
export interface LossCategoryItem {
  /** Machine identifier for the equipment category (e.g., 'tanks', 'artillery'). */
  id: WarLossCategory;
  /** Total photo- and video-verified Russian losses in units. */
  rf: number;
  /** Total photo- and video-verified Ukrainian losses in units. */
  ua: number;
  /** Relative loss ratio formatted as `RF:UA` (e.g. 3.2). */
  ratio?: number;
}

/** Rich data point object formatted for ECharts category bar tooltips. */
export interface LossCategoryDataPoint {
  /** Primary numeric loss count for the bar height (units). */
  value: number;
  /** Equipment category identifier. */
  category?: WarLossCategory;
  /** Precomputed comparative ratio. */
  ratio?: number;
}

/** Top-level KPI metrics summarizing verified heavy equipment losses across all categories. */
export interface LossSummaryData {
  /** Cumulative verified Russian equipment losses (units). */
  totalRf: number;
  /** Cumulative verified Ukrainian equipment losses (units). */
  totalUa: number;
  /** Overall relative loss ratio (RF count / UA count). */
  overallRatio: number;
  /** Total records present in the geolocated map database. */
  totalRecords: number;
  /** Total unrecognized or unclassified equipment records skipped during extraction. */
  unclassifiedRecords?: number;
  /** Breakdown list across all standard military equipment categories. */
  categories: LossCategoryItem[];
}

/** Structured dataset driving the category comparison bar chart. */
export interface LossCategoryChartData {
  /** Category identifier list in display order. */
  categories: WarLossCategory[];
  /** Russian loss counts (units). */
  rf: number[];
  /** Ukrainian loss counts (units). */
  ua: number[];
  /** Precomputed comparative ratio per category. */
  ratios: number[];
}

/** Section dataset for category-losses. */
export interface CategoryLossesSectionData {
  categoryChart: LossCategoryChartData;
  summary: LossSummaryData;
}
