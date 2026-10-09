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
