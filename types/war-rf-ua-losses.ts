/** Equipment loss tally and comparative ratio for a specific weapon category. */
export interface LossCategoryItem {
  /** Machine identifier for the equipment category (e.g., 'tanks', 'artillery'). */
  id: string;
  /** English display label for the category. */
  label_en: string;
  /** Russian display label for the category. */
  label_ru?: string;
  /** Total photo- and video-verified Russian losses in units. */
  rf: number;
  /** Total photo- and video-verified Ukrainian losses in units. */
  ua: number;
  /** Relative loss ratio formatted as `RF:UA` (e.g. "3.2"). */
  ratio?: number | string;
}

/** Rich data point object formatted for ECharts category bar tooltips. */
export interface LossCategoryDataPoint {
  /** Primary numeric loss count for the bar height (units). */
  value: number;
  /** English category label. */
  label_en?: string;
  /** Russian category label. */
  label_ru?: string;
  /** Precomputed comparative ratio string. */
  ratio?: string | number;
}

/** Category loss tally for a single timeline month in tooltip breakdown tables. */
export interface LossTimelineBreakdownItem {
  /** Weapon category display label. */
  name: string;
  /** Verified Russian losses for the period (units). */
  rf: number;
  /** Verified Ukrainian losses for the period (units). */
  ua: number;
}

/** Timeline chart data point embedding a detailed multi-category loss breakdown. */
export interface LossTimelineDataPoint {
  /** Total monthly loss count for the series (units). */
  value: number;
  /** Russian monthly loss total (units). */
  rf?: number;
  /** Ukrainian monthly loss total (units). */
  ua?: number;
  /** Breakdown of losses by weapon category for interactive tooltip inspection. */
  breakdown?: LossTimelineBreakdownItem[];
}

/** Top-level KPI metrics summarizing verified heavy equipment losses across all categories. */
export interface LossSummaryData {
  /** Cumulative verified Russian equipment losses (units). */
  total_rf: number;
  /** Cumulative verified Ukrainian equipment losses (units). */
  total_ua: number;
  /** Overall relative loss ratio (RF count / UA count). */
  overall_ratio: number | string;
  /** Total records present in the geolocated map database. */
  total_records: number;
  /** Total unclassified or unassigned records in the database. */
  total_unknown: number;
  /** Breakdown list across all standard military equipment categories. */
  categories: LossCategoryItem[];
}

/** Basic key-value pair representing a categorized loss metric. */
export interface LossSeriesItem {
  /** Category or series item name. */
  name: string;
  /** Loss count (units). */
  value: number;
}

/** Structured dataset driving the category comparison bar chart. */
export interface LossCategoryChartData {
  /** Category axis label list in display order. */
  labels: string[];
  /** Russian loss series containing raw counts or enriched data point objects. */
  rf_series: (number | LossCategoryDataPoint)[];
  /** Ukrainian loss series containing raw counts or enriched data point objects. */
  ua_series: (number | LossCategoryDataPoint)[];
  /** Precomputed category ratio map keyed by category identifier. */
  ratios?: Record<string, string>;
}

/** Structured timeline data arrays spanning February 2022 to the current period. */
export interface LossOverallTimelineData {
  /** Monthly Russian loss series (units). */
  rf_series: (number | LossTimelineDataPoint)[];
  /** Monthly Ukrainian loss series (units). */
  ua_series: (number | LossTimelineDataPoint)[];
}

/** Documented losses for a specific military equipment model. */
export interface LossEquipmentModel {
  /** Full military equipment model designation (e.g., 'T-80BVM', 'M2A2 Bradley'). */
  name: string;
  /** Total verified loss count for this specific model (units). */
  count: number;
}

/** Sub-model loss breakdown for a specific equipment category. */
export interface LossCategoryDetailData {
  /** Breakdown of equipment models by faction. */
  models?: {
    /** Russian verified lost models sorted by frequency. */
    rf?: LossEquipmentModel[];
    /** Ukrainian verified lost models sorted by frequency. */
    ua?: LossEquipmentModel[];
  };
}

/** Static root JSON dataset structure for the RF / UA military losses dashboard. */
export interface WarLossesDataset {
  /** High-level summary KPI metrics and category totals. */
  summary: LossSummaryData;
  /** Sequential month labels in `YYYY-MM` format. */
  periods: string[];
  /** Continuous monthly timeline loss series. */
  overall_timeline: LossOverallTimelineData;
  /** Category comparison chart series data. */
  category_chart: LossCategoryChartData;
  /** Granular model-by-model breakdown keyed by category identifier. */
  by_category: Record<string, LossCategoryDetailData>;
}
