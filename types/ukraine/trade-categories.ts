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
