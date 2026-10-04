/** Annual state budget execution, sovereign debt dynamics, and GDP indicators for Ukraine. */
export interface UaBudgetDebtData {
  /** 4-digit calendar years. */
  years: number[];
  /** Year label strings for category axis rendering. */
  yearLabels: string[];
  /** Annual average exchange rate (UAH / USD). */
  rates: number[];
  /** Net annual budget balance (domestic revenues - total expenditures) in billion USD. */
  balances: number[];
  /** Nominal gross domestic product in billion USD (null for war years with pending official revisions). */
  gdp: (number | null)[];
  /** Total budget expenditures as a share of nominal GDP (0–100 percent). */
  expGdpPct: (number | null)[];
  /** Total revenues and external financing as a share of nominal GDP (0–100 percent). */
  revGdpPct: (number | null)[];
  /** Gross external state debt as a share of nominal GDP (0–100 percent). */
  debtGdpPct: (number | null)[];
  /** Military and defense sector expenditures in billion USD. */
  defense: number[];
  /** Defense spending share of total annual expenditures (0–100 percent). */
  defensePct: number[];
  /** Non-defense social and operational government expenditures in billion USD. */
  otherExp: number[];
  /** Non-defense spending share of total annual expenditures (0–100 percent). */
  otherExpPct: number[];
  /** Total consolidated state budget expenditures in billion USD. */
  totalExp: number[];
  /** Domestic tax and customs revenues in billion USD. */
  domesticRev: number[];
  /** Domestic revenues share of total budget financing (0–100 percent). */
  domesticRevPct: number[];
  /** Non-repayable international financial grants in billion USD. */
  grants: number[];
  /** Grants share of total budget financing (0–100 percent). */
  grantsPct: number[];
  /** Concessional international loans and macro-financial assistance in billion USD. */
  loans: number[];
  /** Concessional loans share of total budget financing (0–100 percent). */
  loansPct: number[];
  /** Sum of domestic revenues, international grants, and loan financing in billion USD. */
  totalRevFin: number[];
  /** Cumulative gross external public and publicly guaranteed debt in billion USD. */
  debt: number[];
}

/** Compact tuple representing partner trade volume: [regionCode, valueInBillions, sharePercent]. */
export type TradePartnerTuple = [code: string, value: number, share: number];

/** Annual trade balance and foreign trade partner breakdown for Ukraine. */
export interface UaTradeData {
  /** 4-digit calendar years. */
  years: number[];
  /** Total annual merchandise exports in billion USD. */
  totalExports: number[];
  /** Total annual merchandise imports in billion USD. */
  totalImports: number[];
  /** Net merchandise trade balance (exports - imports) in billion USD. */
  tradeBalance: number[];
  /** Annual merchandise exports by partner per year [yearIndex]: [code, value, share] sorted descending by value. */
  exports: TradePartnerTuple[][];
  /** Annual merchandise imports by partner per year [yearIndex]: [code, value, share] sorted descending by value. */
  imports: TradePartnerTuple[][];
}

/** Static root JSON dataset structure for Ukraine indicators. */
export interface UkraineDataset {
  /** State budget execution, gross debt, and GDP time-series. */
  budgetDebt: UaBudgetDebtData;
  /** Foreign trade structure, deficit, and bilateral partner breakdown. */
  trade: UaTradeData;
}

/** Legacy alias for backward compatibility. */
export type UaEconomicDataset = UkraineDataset;
