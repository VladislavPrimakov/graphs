/** Aggregate statistical metrics and peak records for a specific strike category. */
export interface AttackItemSummary {
  /** Cumulative count of launched strike units throughout the recorded conflict. */
  total: number;
  /** Mean monthly launch volume (units / month). */
  monthly_avg: number;
  /** Maximum single-month launch volume (units). */
  peak_count: number;
  /** Month identifier of highest launch volume in `YYYY-MM` format. */
  peak_period: string;
  /** Mean daily launch volume (units / day). */
  daily_avg: number;
  /** Maximum single-day launch volume (units). */
  daily_peak_count: number;
  /** Date of highest single-day launch volume in `YYYY-MM-DD` format. */
  daily_peak_date: string;
  /** Category share relative to total air strikes (0–100 percent). */
  share_pct?: number;
}

/** Comprehensive air strike summary metrics categorized by weapon system type. */
export interface AttacksSummary {
  /** Total launched long-range weapons across all recorded types. */
  total_launched?: number;
  /** Total intercepted or neutralized strike units. */
  total_destroyed?: number;
  /** Cumulative count of long-range strike UAVs launched or intercepted. */
  total_uavs?: number;
  /** Cumulative count of ballistic missile systems launched or intercepted. */
  total_ballistic?: number;
  /** Cumulative count of cruise missile systems launched or intercepted. */
  total_cruise?: number;
  /** Cumulative count of all missile systems launched or intercepted. */
  total_missiles?: number;
  /** Total count of strikes across all categories. */
  total_intercepted?: number;
  /** Overall air defense interception efficiency (0–100 percent). */
  intercept_rate_pct?: number;
  /** Mean daily interception count across all weapon systems. */
  daily_avg_intercepts?: number;
  /** Mean daily UAV interception count. */
  daily_avg_uavs?: number;
  /** Mean daily missile interception count. */
  daily_avg_missiles?: number;
  /** Peak single-day UAV interception count and date. */
  peak_daily_uavs?: { count: number; date: string };
  /** Peak single-day missile interception count and date. */
  peak_daily_missiles?: { count: number; date: string };
  /** Detailed statistics for long-range strike UAVs (e.g., Shahed/Geran, Bober). */
  uavs: AttackItemSummary;
  /** Detailed statistics for ballistic missile systems (e.g., Iskander-M, ATACMS, Tochka-U). */
  ballistic: AttackItemSummary;
  /** Detailed statistics for cruise missile systems (e.g., Kalibr, Kh-101, Storm Shadow). */
  cruise: AttackItemSummary;
}

/** Granular daily and monthly time series and summary for one side of the conflict. */
export interface AttackDataGroup {
  /** Earliest filter boundary date. */
  filter_start_date?: string;
  /** Total number of days recorded. */
  days_covered?: number;
  /** Total number of months recorded. */
  months_covered?: number;
  /** Audit statistics covering classification completeness. */
  audit?: Record<string, unknown>;
  /** Summary metrics for strike types. */
  summary: AttacksSummary;
  /** Granular daily telemetry time series. */
  daily: {
    dates: string[];
    labels: string[];
    uavs: number[];
    ballistic: number[];
    cruise: number[];
    total_missiles: number[];
    total_launched?: number[];
    total_destroyed?: number[];
    total?: number[];
  };
  /** Aggregated monthly telemetry time series. */
  monthly: {
    periods: string[];
    labels: string[];
    uavs: number[];
    ballistic: number[];
    cruise: number[];
    total_missiles: number[];
    total_launched?: number[];
    total_destroyed?: number[];
    total?: number[];
  };
}

/** Time-series arrays of launched strike systems aligned by timestamp labels. */
export interface AttackTimelineSeries {
  /** Sequential timeline category labels (e.g., `YYYY-MM` for monthly, `YYYY-MM-DD` for daily). */
  labels: string[];
  /** Russian strike UAV launch counts per period. */
  rf_uavs: number[];
  /** Russian ballistic missile launch counts per period. */
  rf_ballistic: number[];
  /** Russian cruise missile launch counts per period. */
  rf_cruise: number[];
  /** Ukrainian strike UAV launch counts per period. */
  ua_uavs: number[];
  /** Ukrainian ballistic missile launch counts per period. */
  ua_ballistic: number[];
  /** Ukrainian cruise missile launch counts per period. */
  ua_cruise: number[];
}

/** Dual-resolution timeline structure containing both aggregated monthly and granular daily series. */
export interface AttacksUnifiedTimeline {
  /** Aggregated monthly strike dynamics series. */
  monthly: AttackTimelineSeries;
  /** Granular daily strike dynamics series. */
  daily: AttackTimelineSeries;
}

/** Static root JSON dataset structure for the RF / UA air attacks dashboard. */
export interface WarAttacksDataset {
  /** Russian Federation strike telemetry and weapon statistics. */
  rf_attacks: AttackDataGroup;
  /** Ukrainian strike telemetry and weapon statistics. */
  ua_attacks: AttackDataGroup;
  /** Dual-granularity time-series datasets for timeline charts. */
  unified_timeline: AttacksUnifiedTimeline;
}
