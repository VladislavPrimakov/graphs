/**
 * Annual USD deflator factors normalized to base year 2021 (2021 = 1.0).
 * Multiplier k_t = CPI_2021 / CPI_t converts nominal current USD of year t into constant 2021 USD.
 */
export type CountryDeflatorData = Record<number, number>;
