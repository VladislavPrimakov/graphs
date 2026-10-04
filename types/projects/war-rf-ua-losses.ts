/** Canonical machine identifiers for military equipment loss categories. */
export const WAR_LOSS_CATEGORIES = [
  'tanks',
  'ifv',
  'transport',
  'sp_artillery',
  'air_defense',
  'mlrs',
  'towed_artillery',
  'engineering',
  'radars_jammers',
  'airplanes',
  'helicopters',
  'vessels',
  'imv',
  'anti_tank',
] as const;

/** Canonical military equipment category identifier. */
export type WarLossCategory = (typeof WAR_LOSS_CATEGORIES)[number];

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

/** Structured timeline data arrays spanning February 2022 to the current period. */
export interface LossOverallTimelineData {
  /** Monthly Russian loss series (units). */
  rf: number[];
  /** Monthly Ukrainian loss series (units). */
  ua: number[];
  /** Monthly breakdown list across weapon categories for interactive tooltips. */
  breakdowns: LossTimelineBreakdownItem[][];
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

/** Compact representation of an individual geolocated equipment loss event. */
export type LossMapPoint = [
  lng: number,
  lat: number,
  sideIdx: number,
  catIdx: number,
  modelIdx: number,
  date: string,
  posts: number[],
  sources?: string[],
];

/** Compact static dataset driving the interactive map. */
export interface WarLossMapDataset {
  /** Sequential list of equipment category IDs matching catIdx. */
  categories: WarLossCategory[];
  /** Sequential dictionary of English model names matching modelIdx. */
  models: string[];
  /** Side identifier list matching sideIdx. */
  sides: ['RF', 'UA', 'UNK'];
  /** Flat packed points array: [lng, lat, sideIdx, catIdx, modelIdx, date, posts, sources?]. */
  points: LossMapPoint[];
}

/** Static root JSON dataset structure for the RF / UA military losses dashboard. */
export interface WarLossesDataset {
  /** High-level summary KPI metrics and category totals. */
  summary: LossSummaryData;
  /** Sequential month labels in `YYYY-MM` format. */
  periods: string[];
  /** Continuous monthly timeline loss series. */
  overallTimeline: LossOverallTimelineData;
  /** Category comparison chart series data. */
  categoryChart: LossCategoryChartData;
  /** Granular model-by-model breakdown keyed by category identifier. */
  byCategory: Record<WarLossCategory, LossCategoryDetailData>;
  /** Geolocated losses dataset driving the interactive map. */
  map: WarLossMapDataset;
}

