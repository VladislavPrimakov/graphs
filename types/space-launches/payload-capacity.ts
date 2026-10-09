/** Headline KPI metrics for payload capacity to orbit. */
export interface PayloadCapacitySummary {
  /** Total payload capacity delivered to orbit in metric tons (all-time). */
  totalPayloadTons: number;
  /** Total orbital launch attempts across all tracked history. */
  totalAttempts: number;
  /** Region code of the all-time leader in delivered payload mass. */
  leaderAllTimeRegion: string;
  /** All-time delivered payload mass by the leader nation in metric tons. */
  leaderAllTimeMassTons: number;
  /** Percentage share of all-time payload delivered by the leader nation. */
  leaderAllTimeShare: number;
}

/** Historical annual mass of orbital launch payload capacity delivered by spacefaring nations. */
export interface PayloadCapacityData {
  /** 4-digit calendar launch years from 1958 to present. */
  years: number[];
  /** Annual delivered payload capacity keyed by country/region code in metric tons to LEO/SSO. */
  series: Record<string, number[]>;
  /** Annual launch counts keyed by country/region code. */
  launches: Record<string, number[]>;
}

/** Section dataset for payload-capacity. */
export interface PayloadCapacitySectionData {
  regions: string[];
  summary: PayloadCapacitySummary;
  payloadCapacity: PayloadCapacityData;
}
