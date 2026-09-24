/** Historical annual mass of orbital launch payload capacity delivered by spacefaring nations. */
export interface PayloadCapacityData {
  /** 4-digit calendar launch years from 1958 to present. */
  years: number[];
  /** Annual global total delivered payload capacity in metric tons. */
  totals?: number[];
  /** Annual delivered payload capacity keyed by country/region code in metric tons to LEO/SSO. */
  series: Record<string, number[]>;
}

/** Historical launch cost trends aggregated by decade in constant 2021 USD. */
export interface DecadeCostsData {
  /** Decade interval labels (e.g., '1950s', '1960s', ..., '2020s'). */
  decades: string[];
  /** Estimated average launch cost to low Earth orbit keyed by country/region code in constant 2021 USD/kg. */
  series: Record<string, (number | null)[]>;
}

/** Static root JSON dataset structure for historical space launches and economics. */
export interface SpaceLaunchesDataset {
  /** List of tracked spacefaring regions. */
  regions?: string[];
  /** Annual delivered orbital payload capacity time-series. */
  payload_capacity: PayloadCapacityData;
  /** Decade-level inflation-adjusted launch cost estimates per kg. */
  decade_costs: DecadeCostsData;
}
