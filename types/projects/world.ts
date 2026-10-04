/** Time-series dataset for an individual macroeconomic or industrial metric across major powers. */
export interface WorldChartMetricData {
  /** Annual metric values aligned with the years array, keyed by country code, pre-sorted descending by latest value. */
  series: Record<string, (number | null)[]>;
}

/** Static root JSON dataset comparing macroeconomic scale, industrial base, and clean power generation. */
export interface WorldDataset {
  /** 4-digit calendar years from 2000 to present. */
  years: number[];
  /** Visualized metrics comparing real industrial and economic capacity. */
  charts: {
    /** Real GDP at Purchasing Power Parity (constant 2021 international dollars trillions). */
    gdpPpp: WorldChartMetricData;
    /** Real GDP per capita at Purchasing Power Parity (constant 2021 international dollars). */
    gdpPerCapitaPpp: WorldChartMetricData;
    /** Machinery and capital goods trade turnover under HS Chapter 84 (constant 2021 US$ billions). */
    machineryTurnover: WorldChartMetricData;
    /** Total gross electricity generation across all power sources (terawatt-hours / year). */
    electricityGeneration: WorldChartMetricData;
    /** Solar and wind electricity generation (terawatt-hours / year). */
    cleanPower: WorldChartMetricData;
    /** Annual electricity generation per capita (kWh / inhabitant / year). */
    electricityPerCapita: WorldChartMetricData;
  };
}

/** Legacy alias for backward compatibility. */
export type WorldEconomicDataset = WorldDataset;
