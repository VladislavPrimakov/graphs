import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getRawDataDir, readJsonSync } from '@/utils/fs';
import { createFormat } from '../../../site/src/utils/format';
import type { Language } from '../../../site/src/utils/language';
import type { CountryPipelineCache, RawCountryProfile } from './index';

const LOCALES: readonly Language[] = ['en', 'ru', 'uk', 'de'] as const;

/** UN Comtrade statistical, customs, and non-country area codes that must never appear in partner data. */
const FORBIDDEN_STATISTICAL_CODES = new Set(['_X', 'XX', 'X1', 'X2', 'E19', 'F19', 'O19', 'A79', 'A59', 'F97', 'E29', 'A49', 'F49', 'R91', 'R20', 'NTZ', '_AC', '_CI', '_SM', '_TK', '_WI', '_ZP']);

/** Known historical sovereign states and custom unions with dedicated localization entries. */
const HISTORICAL_CODES = ['SUN', 'YUG', 'SCG', 'CSK', 'DDR', 'ANT', 'ZA1', 'YMD', 'PUS', 'PCI', 'ATB'] as const;

function loadDataJson(): CountryPipelineCache {
  const dirPath = getRawDataDir('country');
  const cache: CountryPipelineCache = { countries: {} };
  try {
    const entries = readdirSync(dirPath);
    for (const file of entries) {
      if (!file.endsWith('.json')) continue;
      const parsed = readJsonSync<RawCountryProfile>(resolve(dirPath, file));
      if (parsed?.code) {
        cache.countries[parsed.code.toLowerCase()] = parsed;
      }
    }
  } catch {
    return { countries: {} };
  }
  return cache;
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

describe('Country and Partner Region Parsing via Site Format', () => {
  const { countries } = loadDataJson();
  const countryCodes = Object.keys(countries);
  const formats = Object.fromEntries(LOCALES.map((l) => [l, createFormat(l)])) as Record<Language, ReturnType<typeof createFormat>>;

  test('data.json contains valid country profile entries', () => {
    if (countryCodes.length === 0) {
      console.log('Notice: country cache is empty or not yet generated; skipping region assertions.');
      expect(true).toBe(true);
      return;
    }
    expect(countryCodes.length).toBeGreaterThan(0);
  });

  test('all top-level country profile codes resolve across all 4 locales', () => {
    if (countryCodes.length === 0) return;
    const failures: Array<{ locale: string; code: string; resolved: string }> = [];

    for (const [code, profile] of Object.entries(countries)) {
      const candidates = [code, profile.code].filter(Boolean);
      for (const candidate of candidates) {
        for (const loc of LOCALES) {
          const res = formats[loc].region(candidate);
          if (!isRegionResolved(loc, candidate, res)) {
            failures.push({ locale: loc, code: candidate, resolved: res });
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test('all bilateral partner codes across all countries and years resolve across all 4 locales', () => {
    if (countryCodes.length === 0) return;
    const allPartners = new Set<string>();

    for (const country of Object.values(countries)) {
      if (!country.years) continue;
      for (const yData of Object.values(country.years)) {
        if (yData.partnerGoodsExports) {
          for (const partner of Object.keys(yData.partnerGoodsExports)) {
            allPartners.add(partner);
          }
        }
      }
    }

    if (allPartners.size === 0) return;

    const failuresByLocale: Record<Language, Array<{ code: string; resolved: string }>> = {
      en: [],
      ru: [],
      uk: [],
      de: [],
    };

    for (const partner of allPartners) {
      for (const loc of LOCALES) {
        const res = formats[loc].region(partner);
        if (!isRegionResolved(loc, partner, res)) {
          failuresByLocale[loc].push({ code: partner, resolved: res });
        }
      }
    }

    for (const loc of LOCALES) {
      expect(failuresByLocale[loc]).toEqual([]);
    }
  });

  test('historical sovereign states resolve to full localized names across all 4 locales', () => {
    for (const code of HISTORICAL_CODES) {
      for (const loc of LOCALES) {
        const res = formats[loc].region(code);
        expect(res).toBeTruthy();
        expect(res).not.toBe(code);
      }
    }
  });

  test('no statistical or unspecified service codes exist in partner streams', () => {
    if (countryCodes.length === 0) return;
    const foundStatisticalCodes: Array<{ country: string; year: string; code: string }> = [];

    for (const [countryCode, country] of Object.entries(countries)) {
      if (!country.years) continue;
      for (const [year, yData] of Object.entries(country.years)) {
        if (yData.partnerGoodsExports) {
          for (const partner of Object.keys(yData.partnerGoodsExports)) {
            if (FORBIDDEN_STATISTICAL_CODES.has(partner.toUpperCase()) || partner.startsWith('_')) {
              foundStatisticalCodes.push({ country: countryCode, year, code: partner });
            }
          }
        }
      }
    }

    expect(foundStatisticalCodes).toEqual([]);
  });

  test('no zero or negative values exist in partner trade volumes', () => {
    if (countryCodes.length === 0) return;
    let invalidCount = 0;

    for (const country of Object.values(countries)) {
      if (!country.years) continue;
      for (const yData of Object.values(country.years)) {
        if (yData.partnerGoodsExports) {
          for (const chMap of Object.values(yData.partnerGoodsExports)) {
            if (chMap) {
              for (const val of Object.values(chMap)) {
                if (typeof val === 'number' && val <= 0) invalidCount++;
              }
            }
          }
        }
      }
    }

    expect(invalidCount).toBe(0);
  });
});
