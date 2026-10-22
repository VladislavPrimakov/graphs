/** Project-level toolbar metadata for Ukraine macroeconomic dynamics dashboard. */
export interface UkraineToolbarMeta {
  /** Earliest calendar year available across Ukraine datasets. */
  minYear: number;
  /** Latest calendar year available across Ukraine datasets. */
  maxYear: number;
  /** Default period range [fromYear, toYear]. */
  defaultPeriod: [number, number];
}

/** Reactive store state for the coordinated Ukraine dashboard toolbar. */
export type UkraineFilterState = {
  labels: boolean;
  years: [number, number];
};

/** Annual state budget execution, sovereign debt dynamics, and GDP indicators for Ukraine. */
export interface UaMacroData {
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
  /** Real GDP physical volume YoY percentage growth (official State Statistics Service / NBU). */
  realGdpGrowth?: (number | null)[];
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
  /** Sovereign external debt (General Government & NBU) in billion USD. */
  govDebt: number[];
  /** Sovereign debt share of total gross external debt (0–100 percent). */
  govDebtPct: number[];
  /** Private external debt (commercial banks, corporations, intercompany) in billion USD. */
  privateDebt: number[];
  /** Private debt share of total gross external debt (0–100 percent). */
  privateDebtPct: number[];
  /** Cumulative gross external public and private debt in billion USD. */
  debt: number[];
}

/** Section dataset for macro. */
export type MacroSectionData = UaMacroData;
/** @deprecated Use MacroSectionData instead. */
export type BudgetDebtSectionData = MacroSectionData;

/** Section dataset for Ukraine Macroeconomic Growth Dynamics (YoY in USD). */
export interface MacroGrowthSectionData {
  /** Sequential calendar years for which YoY change is computed (e.g. [2012, 2013, ..., 2025]). */
  years: number[];
  /** Nominal GDP YoY percentage growth in USD. */
  gdpYoy: (number | null)[];
  /** Nominal GDP YoY difference in billion USD compared to previous year. */
  gdpDiff: (number | null)[];
  /** Nominal GDP absolute volume in billion USD. */
  gdpVal: (number | null)[];
  /** Real GDP physical volume YoY percentage growth (constant prices, official State Statistics Service / NBU). */
  realGdpYoy: (number | null)[];
  /** Domestic revenues YoY percentage growth in USD. */
  domesticRevYoy: (number | null)[];
  /** Domestic revenues YoY difference in billion USD compared to previous year. */
  domesticRevDiff: (number | null)[];
  /** Domestic revenues absolute volume in billion USD. */
  domesticRevVal: number[];
  /** External financing (grants + concessional loans) YoY percentage growth in USD. */
  externalFinYoy: (number | null)[];
  /** External financing YoY difference in billion USD compared to previous year. */
  externalFinDiff: (number | null)[];
  /** External financing absolute volume in billion USD. */
  externalFinVal: number[];
  /** Defense sector expenditures YoY percentage growth in USD. */
  defenseYoy: (number | null)[];
  /** Defense sector expenditures YoY difference in billion USD compared to previous year. */
  defenseDiff: (number | null)[];
  /** Defense sector expenditures absolute volume in billion USD. */
  defenseVal: number[];
  /** Total consolidated state budget expenditures YoY percentage growth in USD. */
  totalExpYoy: (number | null)[];
  /** Total expenditures YoY difference in billion USD compared to previous year. */
  totalExpDiff: (number | null)[];
  /** Total expenditures absolute volume in billion USD. */
  totalExpVal: number[];
  /** Sovereign external public debt YoY percentage growth in USD. */
  govDebtYoy: (number | null)[];
  /** Sovereign external public debt YoY difference in billion USD compared to previous year. */
  govDebtDiff: (number | null)[];
  /** Sovereign external public debt absolute volume in billion USD. */
  govDebtVal: (number | null)[];
  /** Private external debt YoY percentage growth in USD. */
  privateDebtYoy: (number | null)[];
  /** Private external debt YoY difference in billion USD compared to previous year. */
  privateDebtDiff: (number | null)[];
  /** Private external debt absolute volume in billion USD. */
  privateDebtVal: (number | null)[];
}

/** 13 standardized goods and services categories defined by NBU and BPM6 foreign trade classification. */
export const TRADE_CATEGORY_IDS = [
  'agriculture',
  'minerals',
  'chemicals',
  'timber',
  'manufactured',
  'metals',
  'machinery',
  'unclassified_goods',
  'it_services',
  'transport_services',
  'travel',
  'business_services',
  'other',
] as const;

export type TradeCategoryId = (typeof TRADE_CATEGORY_IDS)[number];

/** Compact tuple representing commodity category trade volume: [categoryId, valueInBillions, sharePercent]. */
export type TradeCategoryTuple = [id: TradeCategoryId, value: number, share: number];

/** Section dataset for trade-categories. */
export interface TradeCategoriesSectionData {
  years: number[];
  totalExports: number[];
  totalImports: number[];
  categoryExports: TradeCategoryTuple[][];
  categoryImports: TradeCategoryTuple[][];
}

/** Compact tuple representing partner trade volume: [regionCode, valueInBillions, sharePercent]. */
export type TradePartnerTuple = [code: string, value: number, share: number];

/** Section dataset for trade-partners. */
export interface TradePartnersSectionData {
  years: number[];
  totalExports: number[];
  totalImports: number[];
  exports: TradePartnerTuple[][];
  imports: TradePartnerTuple[][];
}

/** Section dataset for trade-structure. */
export interface TradeStructureSectionData {
  years: number[];
  yearLabels: string[];
  totalExports: number[];
  totalImports: number[];
  tradeBalance: number[];
}

/** Unified dataset for Ukraine dashboard. */
export interface UkraineDataset {
  macro: MacroSectionData;
  'macro-growth': MacroGrowthSectionData;
  'trade-structure': TradeStructureSectionData;
  'trade-categories': TradeCategoriesSectionData;
  'trade-partners': TradePartnersSectionData;
  minYear: number;
  maxYear: number;
  defaultPeriod: [number, number];
}
