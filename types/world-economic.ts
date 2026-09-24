/** National economic entity metadata. */
export interface WorldEntityInfo {
  /** Full English entity display name. */
  name: string;
}

/** Time-series dataset for an individual macroeconomic or industrial metric across major powers. */
export interface WorldChartMetricData {
  /** Unit of physical or economic measurement (e.g., 'TWh', 'Trillion Int$ (PPP)', 'Billion USD'). */
  unit: string;
  /** Annual metric values aligned with the years array, keyed by country code. */
  series: Record<string, (number | null)[]>;
}

/** Static root JSON dataset comparing macroeconomic scale, industrial base, and clean power generation. */
export interface WorldEconomicDataset {
  /** 4-digit calendar years from 2000 to present. */
  years: number[];
  /** Entity metadata map keyed by ISO or custom entity code. */
  entities: Record<string, WorldEntityInfo>;
  /** Visualized metrics comparing real industrial and economic capacity. */
  charts: {
    /** Real GDP at Purchasing Power Parity (constant 2021 international dollars trillions). */
    gdp_ppp: WorldChartMetricData;
    /** Real GDP per capita at Purchasing Power Parity (constant 2021 international dollars). */
    gdp_per_capita_ppp: WorldChartMetricData;
    /** Machinery and capital goods trade turnover under HS Chapter 84 (constant 2021 US$ billions). */
    machinery_turnover: WorldChartMetricData;
    /** Total gross electricity generation across all power sources (terawatt-hours / year). */
    electricity_generation: WorldChartMetricData;
    /** Manufacturing value added deflated by CPI (constant 2015 US$ trillions). */
    manufacturing_value_added: WorldChartMetricData;
    /** Solar and wind electricity generation (terawatt-hours / year). */
    clean_power: WorldChartMetricData;
    /** Annual electricity generation per capita (kWh / inhabitant / year). */
    electricity_per_capita: WorldChartMetricData;
  };
}
