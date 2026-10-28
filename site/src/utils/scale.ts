import { round } from '@graphs/shared/math';
import type { LocalizedFormatters } from './format';

/** Input data type for resolving adaptive scale: either a peak number, a series array, or a tuple of series arrays. */
export type ScalableSeries = (number | null | undefined)[];
export type ScalableData = number | ScalableSeries | readonly ScalableSeries[];

/** Result contract for dynamic monetary scaling returning the scaled data in identical structure. */
export interface AdaptiveScaleResult<T> {
  /** The numerical scale divisor (1e12 for trillions, 1e9 for billions, 1e6 for millions, 1e3 for thousands, or 1 for base USD). */
  divisor: number;
  /** Localized scale abbreviation (e.g. "трлн" / "T" / "Bio.", "млрд" / "B" / "Mrd.", "млн" / "M" / "Mio.", "тыс." / "K" / "Tsd."). */
  scaleLabel: string;
  /** The scaled input data in the exact same structure and dimensions as passed in. */
  data: T;
}

/** Recursively extracts the absolute maximum value from arbitrary scalar, array, or nested datasets. */
function extractPeak(input: unknown): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.abs(input) : 0;
  }
  if (Array.isArray(input)) {
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const v = extractPeak(input[i]);
      if (v > peak) peak = v;
    }
    return peak;
  }
  return 0;
}

/** Recursively scales numbers in the provided scalar, array, or nested dataset by the divisor. */
function scaleInput<T>(input: T, divisor: number, decimals = 2): T {
  if (typeof input === 'number') {
    return round(input / divisor, decimals) as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => scaleInput(item, divisor, decimals)) as T;
  }
  return input;
}

/**
 * Resolves the optimal scale divisor and returns the scaled dataset in the exact same shape.
 */
export function resolveAdaptiveScale<T extends ScalableData>(data: T, fmt: LocalizedFormatters): AdaptiveScaleResult<T> {
  const absMax = extractPeak(data);
  let divisor: number;
  if (absMax >= 1e12) {
    divisor = 1e12;
  } else if (absMax >= 1e9) {
    divisor = 1e9;
  } else if (absMax >= 1e6) {
    divisor = 1e6;
  } else if (absMax >= 1e3) {
    divisor = 1e3;
  } else {
    divisor = 1;
  }

  const scaleLabel = divisor > 1 ? fmt.scale(divisor) : '';

  return {
    divisor,
    scaleLabel,
    data: scaleInput(data, divisor, 2),
  };
}
