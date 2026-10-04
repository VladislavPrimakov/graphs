/** Aggregate statistical metrics and peak records for a specific strike category. */
export interface AttackItemSummary {
  /** Cumulative count of launched strike units throughout the recorded conflict. */
  total: number;
  /** Mean monthly launch volume (units / month). */
  monthlyAvg: number;
  /** Maximum single-month launch volume (units). */
  peakCount: number;
  /** Month identifier of highest launch volume in `YYYY-MM` format. */
  peakPeriod: string;
  /** Mean daily launch volume (units / day). */
  dailyAvg: number;
  /** Maximum single-day launch volume (units). */
  dailyPeakCount: number;
  /** Date of highest single-day launch volume in `YYYY-MM-DD` format. */
  dailyPeakDate: string;
}

/** Comprehensive air strike summary metrics categorized by weapon system type. */
export interface AttacksSummary {
  /** Detailed statistics for long-range strike UAVs (e.g., Shahed/Geran, Bober). */
  uavs: AttackItemSummary;
  /** Detailed statistics for ballistic missile systems (e.g., Iskander-M, ATACMS, Tochka-U). */
  ballistic: AttackItemSummary;
  /** Detailed statistics for cruise missile systems (e.g., Kalibr, Kh-101, Storm Shadow). */
  cruise: AttackItemSummary;
}

/** Granular daily and monthly time series and summary for one side of the conflict. */
export interface AttackDataGroup {
  /** Summary metrics for strike types. */
  summary: AttacksSummary;
  /** Granular daily telemetry time series (internal to pipeline). */
  daily?: {
    dates: string[];
    labels: string[];
    uavs: number[];
    ballistic: number[];
    cruise: number[];
    totalMissiles: number[];
  };
  /** Aggregated monthly telemetry time series (internal to pipeline). */
  monthly?: {
    periods: string[];
    labels: string[];
    uavs: number[];
    ballistic: number[];
    cruise: number[];
    totalMissiles: number[];
  };
}

/** Time-series arrays of launched strike systems aligned by timestamp labels. */
export interface AttackTimelineSeries {
  /** Sequential timeline category labels (e.g., `YYYY-MM` for monthly, `YYYY-MM-DD` for daily). */
  labels: string[];
  /** Russian strike UAV launch counts per period. */
  rfUavs: number[];
  /** Russian ballistic missile launch counts per period. */
  rfBallistic: number[];
  /** Russian cruise missile launch counts per period. */
  rfCruise: number[];
  /** Ukrainian strike UAV launch counts per period. */
  uaUavs: number[];
  /** Ukrainian ballistic missile launch counts per period. */
  uaBallistic: number[];
  /** Ukrainian cruise missile launch counts per period. */
  uaCruise: number[];
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
  rfAttacks: {
    summary: AttacksSummary;
  };
  /** Ukrainian strike telemetry and weapon statistics. */
  uaAttacks: {
    summary: AttacksSummary;
  };
  /** Dual-granularity time-series datasets for timeline charts. */
  unifiedTimeline: AttacksUnifiedTimeline;
}
