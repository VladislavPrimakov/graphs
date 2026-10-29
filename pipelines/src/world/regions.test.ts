import { describe, expect, test } from 'bun:test';
import { getRawDataPath, readJsonSync } from '@/utils/fs';
import { createFormat } from '../../../site/src/utils/format';
import type { Language } from '../../../site/src/utils/language';
import { CURRENT_YEAR, START_YEAR, type WorldPipelineCache } from './index';

const LOCALES: readonly Language[] = ['en', 'ru', 'uk', 'de'] as const;

/** Forbidden unmapped or statistical codes that must never appear in final production datasets. */
const FORBIDDEN_CODES = new Set(['XKX', 'WLD', '1W', 'OWID_WRL', 'World', '_X', 'XX']);

function loadWorldCacheData(): WorldPipelineCache {
  const filePath = getRawDataPath('world');
  try {
    return readJsonSync<WorldPipelineCache>(filePath);
  } catch {
    return { sections: {} } as WorldPipelineCache;
  }
}

function loadPublicWorldEntities(cache: WorldPipelineCache): Set<string> {
  const allEntities = new Set<string>();
  for (const sec of Object.values(cache.sections ?? {})) {
    if (sec.series) {
      for (const k of Object.keys(sec.series)) {
        allEntities.add(k);
      }
    }
  }
  return allEntities;
}

function isRegionResolved(lang: Language, code: string, localized: string): boolean {
  if (!localized || typeof localized !== 'string' || localized.trim() === '') {
    return false;
  }
  const upper = code.toUpperCase();
  if (lang !== 'en') {
    // In ru, uk, de, localized region names are words (Cyrillic or German), never raw Latin codes
    if (localized.toUpperCase() === upper && upper !== 'OTHERS') {
      return false;
    }
  } else {
    // In en, short name for United States is 'US', and 'Others' is 'Others'
    if (localized.toUpperCase() === upper && upper !== 'US' && upper !== 'OTHERS') {
      return false;
    }
  }
  return true;
}

describe('World Dashboard Region and Dataset Validation via Site Format', () => {
  const cache = loadWorldCacheData();
  const publicEntities = loadPublicWorldEntities(cache);
  const formats = Object.fromEntries(LOCALES.map((l) => [l, createFormat(l)])) as Record<Language, ReturnType<typeof createFormat>>;

  test('world cache contains all required sections', () => {
    expect(cache.sections).toBeDefined();
    expect(cache.sections['gdp-ppp']).toBeDefined();
    expect(cache.sections['gdp-per-capita-ppp']).toBeDefined();
    expect(cache.sections['manufacturing-per-capita']).toBeDefined();
    expect(cache.sections['passenger-cars']).toBeDefined();
    expect(cache.sections['clean-power']).toBeDefined();
    expect(cache.sections['electricity-generation']).toBeDefined();
    expect(cache.sections['electricity-per-capita']).toBeDefined();
  });

  test('all sections are bounded within valid years [START_YEAR, CURRENT_YEAR]', () => {
    for (const [_secId, sec] of Object.entries(cache.sections)) {
      expect(sec.years.length).toBeGreaterThan(0);
      expect(sec.years[0]).toBe(START_YEAR);
      const lastYear = sec.years[sec.years.length - 1];
      expect(lastYear).toBeLessThanOrEqual(CURRENT_YEAR);
      expect(lastYear).toBeGreaterThanOrEqual(CURRENT_YEAR - 1);
    }
  });

  test('no forbidden codes exist in public world datasets', () => {
    const foundForbidden: string[] = [];
    for (const code of publicEntities) {
      if (FORBIDDEN_CODES.has(code)) {
        foundForbidden.push(code);
      }
    }
    expect(foundForbidden).toEqual([]);
  });

  test('all public world entities resolve across all 4 locales', () => {
    expect(publicEntities.size).toBeGreaterThan(0);
    const failures: Array<{ locale: string; code: string; resolved: string }> = [];

    for (const code of publicEntities) {
      for (const loc of LOCALES) {
        const res = formats[loc].region(code);
        if (!isRegionResolved(loc, code, res)) {
          failures.push({ locale: loc, code, resolved: res });
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test('all countries and entities across all L1 cache sections resolve via fmt.region across all 4 locales', () => {
    const failures: Array<{ section: string; locale: string; code: string; resolved: string }> = [];

    for (const [secId, sec] of Object.entries(cache.sections || {})) {
      const entityCodes = Object.keys(sec.series || {});
      expect(entityCodes.length).toBeGreaterThan(0);

      for (const code of entityCodes) {
        for (const loc of LOCALES) {
          const res = formats[loc].region(code);
          if (!isRegionResolved(loc, code, res)) {
            failures.push({ section: secId, locale: loc, code, resolved: res });
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test('Kosovo (XK) resolves to localized name across all 4 locales', () => {
    for (const loc of LOCALES) {
      const res = formats[loc].region('XK');
      expect(isRegionResolved(loc, 'XK', res)).toBe(true);
      expect(res).not.toBe('XK');
      expect(res).not.toBe('XKX');
    }
  });
});
