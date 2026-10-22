/** Map of 2-digit HS chapters to volume in billion USD: { "01": 1.25, "84": 15.4 } */
export type CategoryTradeMap = Record<string, number>;

/** Unified bilateral merchandise trade balance between two sovereign partner countries. */
export interface BilateralTradeData {
  exports: CategoryTradeMap;
  imports: CategoryTradeMap;
  totalExports: number;
  totalImports: number;
  balance: number;
}

/**
 * Resolves bilateral trade between Country A and Country B for a given year.
 * Symmetrically retrieves:
 * - Direct exports A -> B from countryA.years[year].partnerGoodsExports[countryB.code]
 * - Direct imports A <- B from countryB.years[year].partnerGoodsExports[countryA.code] (country B's declared export to A)
 */
export function getBilateralTrade(
  countryA: { years?: Record<string, { partnerGoodsExports?: Record<string, CategoryTradeMap> | null }> } | undefined,
  countryB: { code: string; years?: Record<string, { partnerGoodsExports?: Record<string, CategoryTradeMap> | null }> } | undefined,
  year: number | string,
  countryACode: string,
): BilateralTradeData {
  const yStr = String(year);
  const aYear = countryA?.years?.[yStr];
  const bYear = countryB?.years?.[yStr];

  const exports = (countryB ? aYear?.partnerGoodsExports?.[countryB.code] : undefined) || {};
  const imports = (countryB ? bYear?.partnerGoodsExports?.[countryACode] : undefined) || {};

  let totalExports = 0;
  for (const val of Object.values(exports)) totalExports += val;
  let totalImports = 0;
  for (const val of Object.values(imports)) totalImports += val;

  totalExports = Math.round(totalExports * 1000) / 1000;
  totalImports = Math.round(totalImports * 1000) / 1000;
  const balance = Math.round((totalExports - totalImports) * 1000) / 1000;

  return {
    exports,
    imports,
    totalExports,
    totalImports,
    balance,
  };
}
