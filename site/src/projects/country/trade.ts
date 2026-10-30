import type { CountryTradeFlow, CountryYearRecord } from '@graphs/shared/types/country';
import type { LocalizedFormatters } from '@/utils/format';
import { resolveAdaptiveScale } from '@/utils/scale';

/** Calculates aggregate trade volume for a single flow across optional partner and category filters. */
export function getFlowVolume(flow: CountryTradeFlow, isDetailed: boolean, countries: readonly string[], categories: readonly string[]): number {
  if (categories.length > 0) {
    let tot = 0;
    if (countries.length > 0) {
      for (let i = 0; i < countries.length; i++) {
        const p = flow.partners?.[countries[i]];
        const map = isDetailed ? p?.d : p?.m;
        for (let j = 0; j < categories.length; j++) {
          const v = map?.[categories[j]];
          if (v) tot += v;
        }
      }
    } else {
      const map = isDetailed ? flow.d : flow.m;
      for (let j = 0; j < categories.length; j++) {
        const v = map?.[categories[j]];
        if (v) tot += v;
      }
    }
    return tot;
  }

  if (countries.length > 0) {
    let tot = 0;
    for (let i = 0; i < countries.length; i++) {
      const p = flow.partners?.[countries[i]];
      if (p?.t) tot += p.t;
    }
    return tot;
  }

  return flow.t ?? 0;
}

/** Determines optimal scale label for toolbar metric toggle based on filtered trade flow peak. */
export function resolveFlowScale(timeline: readonly CountryYearRecord[], isDetailed: boolean, countries: readonly string[], categories: readonly string[], fmt: LocalizedFormatters): string {
  let peak = 0;
  for (let i = 0; i < timeline.length; i++) {
    const y = timeline[i];
    const exp = getFlowVolume(y.exports, isDetailed, countries, categories);
    const imp = getFlowVolume(y.imports, isDetailed, countries, categories);
    if (exp > peak) peak = exp;
    if (imp > peak) peak = imp;
  }
  return resolveAdaptiveScale(peak, fmt).scaleLabel;
}

/** Extracts category-to-volume breakdown dictionary for a specific flow and year. */
export function getYearCategoryBreakdown(flow: CountryTradeFlow, isDetailed: boolean, countries: readonly string[]): Record<string, number> {
  if (countries.length === 0) {
    return (isDetailed ? flow.d : flow.m) || {};
  }
  const map: Record<string, number> = {};
  for (let i = 0; i < countries.length; i++) {
    const p = flow.partners?.[countries[i]];
    if (!p) continue;
    const catMap = isDetailed ? p.d : p.m;
    for (const code in catMap) {
      map[code] = (map[code] || 0) + catMap[code];
    }
  }
  return map;
}

/** Extracts partner-to-volume breakdown dictionary for a specific flow and year. */
export function getYearPartnerBreakdown(flow: CountryTradeFlow, isDetailed: boolean, categories: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const partners = flow.partners || {};
  const catCount = categories.length;

  if (catCount === 0) {
    for (const pCode in partners) {
      const tot = partners[pCode]?.t;
      if (tot && tot > 0) map[pCode] = tot;
    }
    return map;
  }

  if (catCount === 1) {
    const singleCat = categories[0];
    for (const pCode in partners) {
      const partner = partners[pCode];
      if (!partner) continue;
      const catMap = isDetailed ? partner.d : partner.m;
      const v = catMap?.[singleCat];
      if (v && v > 0) map[pCode] = v;
    }
    return map;
  }

  for (const pCode in partners) {
    const partner = partners[pCode];
    if (!partner) continue;
    const catMap = isDetailed ? partner.d : partner.m;
    let val = 0;
    for (let i = 0; i < catCount; i++) {
      const v = catMap?.[categories[i]];
      if (v) val += v;
    }
    if (val > 0) map[pCode] = val;
  }
  return map;
}
