/** 8 standardized commodity groups defined by NBU and BPM6 foreign trade classification. */
export const TRADE_CATEGORY_IDS = ['agriculture', 'minerals', 'chemicals', 'timber', 'manufactured', 'metals', 'machinery', 'other'] as const;

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
