/**
 * Shared mathematical, statistical, and precision rounding utilities for ETL pipelines.
 */

/** Rounds a numeric value to a specified number of decimal places. */
export function round(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return 0;
  if (decimals === 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rounds a nullable or optional numeric value to a specified number of decimal places. */
export function roundNullable(value: number | null | undefined, decimals = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return round(value, decimals);
}

/** Computes percentage (numerator / denominator * 100) rounded to specified decimal places. */
export function percentage(numerator: number, denominator: number, decimals = 1): number {
  if (!denominator || denominator <= 0 || !Number.isFinite(numerator)) return 0;
  return round((numerator / denominator) * 100, decimals);
}

/** Computes percentage for nullable denominators (returns null if denominator is null, undefined, or <= 0). */
export function percentageNullable(numerator: number, denominator: number | null | undefined, decimals = 1): number | null {
  if (denominator == null || denominator <= 0 || !Number.isFinite(numerator)) return null;
  return round((numerator / denominator) * 100, decimals);
}

/** Computes ratio (numerator / denominator) rounded to specified decimal places with optional fallback. */
export function ratio(numerator: number, denominator: number, decimals = 2, fallback?: number): number | undefined {
  if (!denominator || denominator <= 0 || !Number.isFinite(numerator)) return fallback;
  return round(numerator / denominator, decimals);
}

/** Computes the arithmetic mean of an array of numbers, rounded to specified decimal places. */
export function average(values: readonly number[], decimals = 1): number {
  if (!values.length) return 0;
  let total = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      total += v;
      count++;
    }
  }
  return count > 0 ? round(total / count, decimals) : 0;
}

/** Computes the sum of finite numbers in an array. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

/**
 * Scales a numeric value by powers of a thousand (10^(3 * magnitude)), optionally applying an exchange/conversion rate and rounding.
 * Default magnitude = 1 shifts by 10^3 (thousands: e.g. millions -> billions), magnitude = 2 shifts by 10^6 (millions).
 */
export function scaleMagnitude(value: number, magnitude = 1, fxRate = 1, decimals?: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(fxRate) || fxRate <= 0) return 0;
  const factor = 10 ** (3 * magnitude);
  const val = value / factor / fxRate;
  return decimals !== undefined ? round(val, decimals) : val;
}

/** Generates an array of sequential integers from start to end inclusive. */
export function range(start: number, end: number, step = 1): number[] {
  if (step <= 0 || start > end) return [];
  const result: number[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}
