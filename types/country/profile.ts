/** 10 standardized physical goods macro categories (covering all 97 HS-2 chapters). */
export const GOODS_CATEGORY_IDS = [
  'agriculture',
  'minerals',
  'chemicals_plastics',
  'wood_paper',
  'textiles_apparel',
  'stone_glass',
  'metals',
  'machinery_electronics',
  'transport',
  'misc_instruments',
] as const;

export type GoodsCategoryId = (typeof GOODS_CATEGORY_IDS)[number];

/** 7 standardized commercial services categories based on UN Comtrade EBOPS classification. */
export const SERVICES_CATEGORY_IDS = ['services_it', 'services_transport', 'services_travel', 'services_financial', 'services_ip', 'services_business', 'services_other'] as const;

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

/** Bilateral trade partner volume tuple: [iso3Code, valueInBillions, sharePercent]. */
export type CountryPartnerTuple = [code: string, value: number, share: number];

/** Category trade breakdown volume tuple: [id, valueInBillions, sharePercent]. */
export type CountryCategoryTuple = [id: string, value: number, share: number];

/** Complete standalone country trade and macroeconomic profile dataset. */
export interface CountryProfileData {
  /** ISO 3166-1 alpha-2 country code in lowercase (e.g. 'us', 'de'). */
  code: string;
  /** Consecutive calendar years (e.g. [1990, 1991, ..., 2025]). */
  years: number[];
  /** Trade totals over time in billion USD (goods, services, and combined). */
  trade: {
    /** Total merchandise (goods) exports in billion USD. */
    goodsExportsUsd: (number | null)[];
    /** Total merchandise (goods) imports in billion USD. */
    goodsImportsUsd: (number | null)[];
    /** Merchandise (goods) net trade balance in billion USD. */
    goodsBalanceUsd: (number | null)[];

    /** Total commercial services exports in billion USD. */
    servicesExportsUsd: (number | null)[];
    /** Total commercial services imports in billion USD. */
    servicesImportsUsd: (number | null)[];
    /** Commercial services net trade balance in billion USD. */
    servicesBalanceUsd: (number | null)[];

    /** Combined total exports (goods + services) in billion USD. */
    totalExportsUsd: (number | null)[];
    /** Combined total imports (goods + services) in billion USD. */
    totalImportsUsd: (number | null)[];
    /** Combined net trade balance (exports - imports) in billion USD. */
    netBalanceUsd: (number | null)[];
  };
  /** Trade breakdown by commodity and service categories. */
  categories: {
    /** 17 aggregated macro categories (10 goods + 7 services) per year sorted by volume descending. */
    macro: {
      /** Exports breakdown per year sorted by volume descending. */
      exports: CountryCategoryTuple[][];
      /** Imports breakdown per year sorted by volume descending. */
      imports: CountryCategoryTuple[][];
    };
    /** Detailed breakdown: 97 HS-2 chapters + 11 EBOPS 2002 service codes per year sorted by volume descending. */
    detailed: {
      /** Exports breakdown per year sorted by volume descending. */
      exports: CountryCategoryTuple[][];
      /** Imports breakdown per year sorted by volume descending. */
      imports: CountryCategoryTuple[][];
    };
    /** Precomputed active macro categories with positive volume, sorted by latest year volume descending. */
    activeMacro: [id: TradeCategoryId, count: number][];
    /** Precomputed active detailed codes with positive volume, sorted by latest year volume descending. */
    activeDetailed: [code: string, count: number][];
  };
  /** Bilateral trading partners per year matching consecutive years array index. */
  partners: {
    /** Bilateral merchandise export partners per year sorted by volume descending. */
    exports: CountryPartnerTuple[][];
    /** Bilateral merchandise import partners per year sorted by volume descending. */
    imports: CountryPartnerTuple[][];
    /** Precomputed active bilateral trading partners sorted by latest year volume descending. */
    topPartners: [code: string, count: number][];
  };
  /** Comprehensive macroeconomic indicators from IMF World Economic Outlook (WEO). */
  macro: {
    /** Nominal GDP in billion USD. */
    gdpNominalUsd: (number | null)[];
    /** Real GDP physical volume YoY percentage growth rate. */
    gdpRealGrowthYoy: (number | null)[];
    /** Nominal GDP per capita in USD. */
    gdpPerCapitaUsd: (number | null)[];
    /** GDP at purchasing power parity in billion current international dollars. */
    gdpPppUsd: (number | null)[];

    /** General government total expenditure as a percentage of nominal GDP. */
    govExpenditurePctGdp: (number | null)[];
    /** General government total expenditure in billion USD. */
    govExpenditureUsd: (number | null)[];
    /** General government total revenue as a percentage of nominal GDP. */
    govRevenuePctGdp: (number | null)[];
    /** General government total revenue in billion USD. */
    govRevenueUsd: (number | null)[];
    /** General government net lending/borrowing balance as a percentage of nominal GDP. */
    govBalancePctGdp: (number | null)[];
    /** General government net lending/borrowing balance in billion USD. */
    govBalanceUsd: (number | null)[];

    /** General government gross debt as a percentage of nominal GDP. */
    govDebtPctGdp: (number | null)[];
    /** General government gross debt in billion USD. */
    govDebtUsd: (number | null)[];

    /** Consumer price index inflation rate (annual YoY %). */
    inflationPct: (number | null)[];
    /** Unemployment rate as percentage of total labor force. */
    unemploymentPct: (number | null)[];
    /** Current account balance as a percentage of nominal GDP. */
    currentAccountPctGdp: (number | null)[];
    /** Current account balance in billion USD. */
    currentAccountUsd: (number | null)[];

    /** Annual YoY growth dynamics in percentage and USD differences. */
    growth: {
      gdpYoy: (number | null)[];
      gdpDiffUsd: (number | null)[];
      revenueYoy: (number | null)[];
      revenueDiffUsd: (number | null)[];
      expenditureYoy: (number | null)[];
      expenditureDiffUsd: (number | null)[];
      debtYoy: (number | null)[];
      debtDiffUsd: (number | null)[];
    };
  };
}
