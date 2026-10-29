/** 10 standardized physical goods macro categories (covering all 97 HS-2 chapters). */
export const GOODS_CATEGORY_IDS = ['ag', 'mn', 'ch', 'wd', 'tx', 'sg', 'mt', 'mc', 'tr', 'mi'] as const;

export type GoodsCategoryId = (typeof GOODS_CATEGORY_IDS)[number];

/** 7 standardized commercial services categories based on UN Comtrade EBOPS classification. */
export const SERVICES_CATEGORY_IDS = ['it', 'ts', 'tv', 'fn', 'ip', 'bs', 'os'] as const;

export type ServicesCategoryId = (typeof SERVICES_CATEGORY_IDS)[number];

/** Complete 11 UN Comtrade EBOPS 2002 3-digit commercial services codes. */
export const EBOPS_SERVICE_CODES = ['205', '236', '245', '249', '253', '260', '262', '266', '268', '287', '291'] as const;
export type EbopsServiceCode = (typeof EBOPS_SERVICE_CODES)[number];

/** Combined trade categories: 10 goods + 7 services. */
export const TRADE_CATEGORY_IDS = [...GOODS_CATEGORY_IDS, ...SERVICES_CATEGORY_IDS] as const;

export type TradeCategoryId = (typeof TRADE_CATEGORY_IDS)[number];

/** Structural 2-digit Harmonized System (HS-2) chapter item. */
export interface HsChapterItem {
  /** 2-digit HS chapter code (e.g. '01', '84'). */
  code: string;
  /** Parent goods macro category identifier. */
  macroId: GoodsCategoryId;
}

/** Bilateral trading partner record containing total volume and category breakdowns in USD. */
export interface CountryPartnerTradeRecord {
  /** Total bilateral trade volume with partner in USD. */
  total: number;
  /** Trade breakdown by 10 physical goods macro categories in USD: { [macroId]: valueUsd }. */
  macro: Record<string, number>;
  /** Detailed trade breakdown by 2-digit HS chapters in USD: { [chapterCode]: valueUsd }. */
  detailed: Record<string, number>;
}

/** Complete trade flow breakdown (Exports or Imports) for a single calendar year in USD. */
export interface CountryTradeFlow {
  /** Total volume with the world in USD. */
  total: number;
  /** Total merchandise physical goods in USD. */
  goods: number | null;
  /** Total commercial services in USD. */
  services: number | null;
  /** 17 aggregated macro categories breakdown in USD: { [catId]: valueUsd }. */
  macro: Record<string, number>;
  /** Detailed breakdown in USD: 97 HS-2 chapters + 11 EBOPS service codes: { [code]: valueUsd }. */
  detailed: Record<string, number>;
  /** Bilateral trading partners keyed by uppercase ISO-2 / ISO-3 code. */
  partners: Record<string, CountryPartnerTradeRecord>;
}

/** Annual macroeconomic indicators from IMF World Economic Outlook (WEO) in USD. */
export interface CountryMacroYear {
  /** Nominal GDP in USD. */
  gdpNominalUsd: number | null;
  /** Real GDP physical volume YoY percentage growth rate. */
  gdpRealGrowthYoy: number | null;
  /** Nominal GDP per capita in USD. */
  gdpPerCapitaUsd: number | null;
  /** GDP at purchasing power parity in current international dollars. */
  gdpPppUsd: number | null;

  /** General government total expenditure in USD. */
  govExpenditureUsd: number | null;
  /** General government total expenditure as a percentage of nominal GDP. */
  govExpenditurePctGdp: number | null;
  /** General government total revenue in USD. */
  govRevenueUsd: number | null;
  /** General government total revenue as a percentage of nominal GDP. */
  govRevenuePctGdp: number | null;
  /** General government net lending/borrowing balance in USD. */
  govBalanceUsd: number | null;
  /** General government net lending/borrowing balance as a percentage of nominal GDP. */
  govBalancePctGdp: number | null;

  /** General government gross debt in USD. */
  govDebtUsd: number | null;
  /** General government gross debt as a percentage of nominal GDP. */
  govDebtPctGdp: number | null;

  /** Consumer price index inflation rate (annual YoY %). */
  inflationPct: number | null;
  /** Unemployment rate as percentage of total labor force. */
  unemploymentPct: number | null;
  /** Current account balance in USD. */
  currentAccountUsd: number | null;
  /** Current account balance as a percentage of nominal GDP. */
  currentAccountPctGdp: number | null;

  /** Annual YoY growth dynamics in percentage and USD differences. */
  growth: {
    gdpYoy: number | null;
    gdpDiffUsd: number | null;
    revenueYoy: number | null;
    revenueDiffUsd: number | null;
    expenditureYoy: number | null;
    expenditureDiffUsd: number | null;
    debtYoy: number | null;
    debtDiffUsd: number | null;
  };
}

/** Standalone unified snapshot of a country for a single calendar year. */
export interface CountryYearRecord {
  /** Calendar year (e.g. 2023). */
  year: number;
  /** Outgoing trade (Exports) with world total, categories, and bilateral partners in USD. */
  exports: CountryTradeFlow;
  /** Incoming trade (Imports) with world total, categories, and bilateral partners in USD. */
  imports: CountryTradeFlow;
  /** Combined net trade balance (exports.total - imports.total) in USD. */
  netBalanceUsd: number | null;
  /** Comprehensive macroeconomic indicators from IMF WEO. */
  macro: CountryMacroYear;
}

/** Complete standalone country trade and macroeconomic profile dataset. */
export interface CountryProfileData {
  /** ISO 3166-1 alpha-2 country code in lowercase (e.g. 'us', 'de'). */
  code: string;
  /** Consecutive calendar years (e.g. [1990, 1991, ..., 2025]). */
  years: number[];

  /** Precomputed active macro categories with positive volume, sorted by latest year volume descending. */
  activeMacro: [id: TradeCategoryId, volumeUsd: number][];
  /** Precomputed active detailed codes with positive volume, sorted by latest year volume descending. */
  activeDetailed: [code: string, volumeUsd: number][];
  /** Precomputed active bilateral trading partners sorted by latest year volume descending. */
  activePartners: [code: string, volumeUsd: number][];

  /** Chronological timeline of consecutive calendar year records. */
  timeline: CountryYearRecord[];
}
