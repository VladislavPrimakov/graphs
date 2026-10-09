/** Summary KPI indicators for frontline territorial dynamics. */
export interface FrontlineDynamicsSummary {
  /** Timestamp date of latest frontline snapshot in YYYY-MM-DD format. */
  latestDate: string;
  /** Internationally recognized total territory of Ukraine in km² (603,628 km²). */
  totalUkraineKm2: number;
  /** Current consensus Russian control area (km²). */
  currentRfKm2: number;
  /** Current consensus Russian control share (% of Ukraine). */
  currentRfPct: number;
  /** Current consensus Ukrainian control area (km²). */
  currentUaKm2: number;
  /** Current consensus Ukrainian control share (% of Ukraine). */
  currentUaPct: number;
  /** Current contradiction / discrepancy area between sources (km²). */
  currentDisputedKm2: number;
  /** Current contradiction / discrepancy share (% of Ukraine). */
  currentDisputedPct: number;
  /** Historical peak area of consensus Russian control in March 2022 (km²). */
  peakRfKm2: number;
  /** Date of the historical peak in YYYY-MM-DD format. */
  peakRfDate: string;
  /** Historical peak share (% of Ukraine). */
  peakRfPct: number;
  /** Area liberated by Ukraine from the 2022 historical peak (km²). */
  liberatedFromPeakKm2: number;
  /** Net change in consensus Russian control over the last 30 days (km²). */
  netChange30dKm2: number;
}

/** Precomputed monthly time series for territorial control and net changes. */
export interface FrontlineDynamicsMonthly {
  /** Sequential month identifiers (e.g. `['2022-02', '2022-03', ...]`). */
  months: string[];
  /** Short localized month labels (e.g. `['02.22', '03.22', ...]`). */
  labels: string[];
  /** Unique year numbers spanning the dataset (e.g. `[2022, 2023, 2024, 2025, 2026]`). */
  years: number[];
  /** Month-end consensus Russian control area in km². */
  consensusRfKm2: number[];
  /** Month-end consensus Ukrainian control area in km². */
  consensusUaKm2: number[];
  /** Month-end disputed / grey zone area in km². */
  disputedKm2: number[];
  /** Month-end DeepState claimed occupied area in km². */
  dsOccupiedKm2: number[];
  /** Month-end LostArmour claimed control area in km². */
  laClaimedKm2: number[];
  /** Month-end consensus Russian control share (% of Ukraine). */
  consensusRfPct: number[];
  /** Month-end consensus Ukrainian control share (% of Ukraine). */
  consensusUaPct: number[];
  /** Month-end disputed share (% of Ukraine). */
  disputedPct: number[];
  /** Net change in consensus Russian control for the month in km² (positive = Russian advance, negative = Ukrainian liberation). */
  netChangeKm2: number[];
  /** Gross Russian territorial gains during the month in km². */
  rfAdvanceKm2: number[];
  /** Gross Ukrainian territorial liberations during the month in km². */
  uaLiberatedKm2: number[];
}

/** Precomputed daily time series for granular timeline inspection. */
export interface FrontlineDynamicsDaily {
  /** Sequential daily timestamps in YYYY-MM-DD format. */
  dates: string[];
  /** Short date labels (e.g. `['28.01', '29.01', ...]`). */
  labels: string[];
  /** Daily consensus Russian control area in km². */
  consensusRfKm2: number[];
  /** Daily consensus Ukrainian control area in km². */
  consensusUaKm2: number[];
  /** Daily disputed / grey zone area in km². */
  disputedKm2: number[];
  /** Daily DeepState claimed occupied area in km². */
  dsOccupiedKm2: number[];
  /** Daily LostArmour claimed control area in km². */
  laClaimedKm2: number[];
  /** Day-over-day net change in consensus Russian control in km². */
  deltaKm2: number[];
}

/** Section dataset for frontline-dynamics. */
export interface FrontlineDynamicsSectionData {
  /** Summary KPI metrics for current control, peaks, and 30-day pace. */
  summary: FrontlineDynamicsSummary;
  /** Precomputed monthly time series spanning full conflict history. */
  monthly: FrontlineDynamicsMonthly;
  /** Precomputed daily time series for high-resolution inspection. */
  daily: FrontlineDynamicsDaily;
}
