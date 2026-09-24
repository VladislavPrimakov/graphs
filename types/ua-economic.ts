/** Annual state budget execution, sovereign debt dynamics, and GDP indicators for Ukraine. */
export interface UaBudgetDebtData {
  /** 4-digit calendar years. */
  years: number[];
  /** Year label strings for category axis rendering. */
  year_labels: string[];
  /** Annual average exchange rate (UAH / USD). */
  rates: number[];
  /** Net annual budget balance (domestic revenues - total expenditures) in billion USD. */
  balances: number[];
  /** Nominal gross domestic product in billion USD (null for war years with pending official revisions). */
  gdp: (number | null)[];
  /** Total budget expenditures as a share of nominal GDP (0–100 percent). */
  exp_gdp_pct: (number | null)[];
  /** Total revenues and external financing as a share of nominal GDP (0–100 percent). */
  rev_gdp_pct: (number | null)[];
  /** Gross external state debt as a share of nominal GDP (0–100 percent). */
  debt_gdp_pct: (number | null)[];
  /** Military and defense sector expenditures in billion USD. */
  defense: number[];
  /** Defense spending share of total annual expenditures (0–100 percent). */
  defense_pct: number[];
  /** Non-defense social and operational government expenditures in billion USD. */
  other_exp: number[];
  /** Non-defense spending share of total annual expenditures (0–100 percent). */
  other_exp_pct: number[];
  /** Total consolidated state budget expenditures in billion USD. */
  total_exp: number[];
  /** Domestic tax and customs revenues in billion USD. */
  domestic_rev: number[];
  /** Domestic revenues share of total budget financing (0–100 percent). */
  domestic_rev_pct: number[];
  /** Non-repayable international financial grants in billion USD. */
  grants: number[];
  /** Grants share of total budget financing (0–100 percent). */
  grants_pct: number[];
  /** Concessional international loans and macro-financial assistance in billion USD. */
  loans: number[];
  /** Concessional loans share of total budget financing (0–100 percent). */
  loans_pct: number[];
  /** Sum of domestic revenues, international grants, and loan financing in billion USD. */
  total_rev_fin: number[];
  /** Cumulative gross external public and publicly guaranteed debt in billion USD. */
  debt: number[];
}

/** Bilateral trade volume with an individual trading partner country or economic bloc. */
export interface PartnerBreakdownItem {
  /** Partner country or trade bloc name. */
  name: string;
  /** Trade volume in billion USD. */
  value: number;
  /** Percentage share of total annual export or import volume (0–100 percent). */
  pct: number;
}

/** ECharts data point for trade volume bars embedding partner breakdown details. */
export interface TradeSeriesDataPoint {
  /** Total annual trade volume in billion USD. */
  value: number;
  /** Redundant total trade volume in billion USD for direct tooltip access. */
  total: number;
  /** Geographic partner breakdown items sorted by trade volume. */
  partners: PartnerBreakdownItem[];
}

/** Annual trade balance and foreign trade partner breakdown for Ukraine. */
export interface UaTradeData {
  /** 4-digit calendar years. */
  years: number[];
  /** Total annual merchandise exports in billion USD. */
  total_exports: number[];
  /** Total annual merchandise imports in billion USD. */
  total_imports: number[];
  /** Net merchandise trade balance (exports - imports) in billion USD. */
  trade_balance: number[];
  /** List of primary international trade partners. */
  partners: string[];
  /** Yearly export breakdowns by trade partner. */
  exports_breakdown: PartnerBreakdownItem[][];
  /** Yearly import breakdowns by trade partner. */
  imports_breakdown: PartnerBreakdownItem[][];
  /** Time-series export volume keyed by partner country in billion USD. */
  exports_by_partner: Record<string, number[]>;
  /** Time-series import volume keyed by partner country in billion USD. */
  imports_by_partner: Record<string, number[]>;
}

/** Static root JSON dataset structure for Ukraine economic indicators. */
export interface UaEconomicDataset {
  /** State budget execution, gross debt, and GDP time-series. */
  budget_debt: UaBudgetDebtData;
  /** Foreign trade structure, deficit, and bilateral partner breakdown. */
  trade: UaTradeData;
}
