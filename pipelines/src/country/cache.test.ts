import { describe, expect, test } from 'bun:test';
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_BY_ID, COUNTRY_BY_ISO3, SUPPORTED_COUNTRIES } from './countries';
import { CHUNK_SIZE, chunkYears, detectMissingStreams, isCountryComplete, type RawCountryProfile, type RawYearData, REQUIRED_IMF_INDICATORS } from './index';

const TEST_YEARS = [2020, 2021, 2022, 2023, 2024];

function createFullYearData(): RawYearData {
  return {
    exports: { '01': 1.5, '84': 10.2 },
    imports: { '01': 0.8, '84': 8.1 },
    partnerExports: { CA: 50.1, MX: 45.2 },
    partnerImports: { CA: 40.0, MX: 42.1 },
    servicesExports: { '205': 12.3, '262': 8.9 },
    servicesImports: { '205': 10.1, '262': 5.4 },
  };
}

function createFullMacro(years: number[] = TEST_YEARS): RawCountryProfile['macro'] {
  const macro: RawCountryProfile['macro'] = {};
  for (const key of REQUIRED_IMF_INDICATORS) {
    macro[key] = Object.fromEntries(years.map((y) => [String(y), 100 + y]));
  }
  return macro;
}

function createFullProfile(years: number[] = TEST_YEARS): RawCountryProfile {
  const yearsMap: Record<string, RawYearData> = {};
  for (const y of years) {
    yearsMap[String(y)] = createFullYearData();
  }
  return {
    code: 'us',
    years: yearsMap,
    macro: createFullMacro(years),
  };
}

describe('Smart Cache Verification & Invalidation (detectMissingStreams)', () => {
  test('condition 1: completely missing country profile flags all streams and all years', () => {
    const missing = detectMissingStreams(undefined, TEST_YEARS);
    expect(missing.goods).toEqual(TEST_YEARS);
    expect(missing.partners).toEqual(TEST_YEARS);
    expect(missing.services).toEqual(TEST_YEARS);
    expect(missing.needsImf).toBe(true);
    expect(isCountryComplete(undefined, TEST_YEARS)).toBe(false);
  });

  test('condition 2: 100% complete country profile returns zero missing streams and skips fetching', () => {
    const profile = createFullProfile(TEST_YEARS);
    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.partners).toEqual([]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(true);
  });

  test('condition 3: missing partial years for goods only triggers goods refetch for exact years', () => {
    const profile = createFullProfile(TEST_YEARS);
    // Delete exports for 2023 and imports for 2024
    delete profile.years['2023'].exports;
    delete profile.years['2024'].imports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([2023, 2024]);
    expect(missing.partners).toEqual([]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 4: missing partial years for bilateral partners triggers partners refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.years['2021'].partnerExports;
    delete profile.years['2022'].partnerImports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.partners).toEqual([2021, 2022]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 5: missing partial years for commercial services triggers services refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.years['2020'].servicesExports;
    delete profile.years['2024'].servicesImports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.partners).toEqual([]);
    expect(missing.services).toEqual([2020, 2024]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 6: missing nominal GDP indicator flags needsImf', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.macro!.gdpNominalUsd;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.partners).toEqual([]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(true);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 7: null stream without upstream catalog dataset remains complete', () => {
    const profile = createFullProfile(TEST_YEARS);
    profile.years['2020'].servicesExports = null;
    profile.years['2020'].servicesImports = null;

    const catalog = {
      goodsChecksums: new Map<string, number>(),
      servicesChecksums: new Map<string, number>(),
    };

    const missing = detectMissingStreams(profile, TEST_YEARS, 842, catalog);
    expect(missing.services).toEqual([]);
    expect(isCountryComplete(profile, TEST_YEARS, 842, catalog)).toBe(true);
  });

  test('condition 8: null stream with new upstream catalog checksum triggers refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    // Was previously empty (null)
    profile.years['2020'].servicesExports = null;
    profile.years['2020'].servicesImports = null;

    // Upstream catalog now has a dataset published for 2020
    const catalog = {
      goodsChecksums: new Map<string, number>(),
      servicesChecksums: new Map<string, number>([['842:2020', 123456789]]),
    };

    const missing = detectMissingStreams(profile, TEST_YEARS, 842, catalog);
    expect(missing.services).toEqual([2020]);
    expect(isCountryComplete(profile, TEST_YEARS, 842, catalog)).toBe(false);
  });

  test('condition 8b: stream with matching upstream catalog checksum skips refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    profile.years['2020'].servicesExports = null;
    profile.years['2020'].servicesImports = null;
    profile.years['2020'].servicesChecksum = 123456789;

    const catalog = {
      goodsChecksums: new Map<string, number>(),
      servicesChecksums: new Map<string, number>([['842:2020', 123456789]]),
    };

    const missing = detectMissingStreams(profile, TEST_YEARS, 842, catalog);
    expect(missing.services).toEqual([]);
    expect(isCountryComplete(profile, TEST_YEARS, 842, catalog)).toBe(true);
  });

  test('condition 9: null nominal GDP indicator flags needsImf to re-query upstream', () => {
    const profile = createFullProfile(TEST_YEARS);
    profile.macro!.gdpNominalUsd = null;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.needsImf).toBe(true);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });
});

describe('Year Chunking Logic (chunkYears)', () => {
  test('handles empty years array', () => {
    expect(chunkYears([])).toEqual([]);
  });

  test('handles single year', () => {
    expect(chunkYears([2024])).toEqual([[2024]]);
  });

  test('handles exact chunk boundary (12 years)', () => {
    const years = Array.from({ length: 12 }, (_, i) => 2000 + i);
    const chunks = chunkYears(years, CHUNK_SIZE);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(12);
  });

  test('splits 13 years into 2 chunks: [12, 1]', () => {
    const years = Array.from({ length: 13 }, (_, i) => 2000 + i);
    const chunks = chunkYears(years, 12);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(12);
    expect(chunks[1]).toEqual([2012]);
  });

  test('splits full historical span 1990..2026 (37 years) into 4 chunks [12, 12, 12, 1]', () => {
    const years = Array.from({ length: 37 }, (_, i) => 1990 + i);
    const chunks = chunkYears(years, 12);
    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(12);
    expect(chunks[1].length).toBe(12);
    expect(chunks[2].length).toBe(12);
    expect(chunks[3]).toEqual([2026]);
  });
});

describe('Country Catalog Integrity & Lookup Maps', () => {
  test('COUNTRIES contains exactly 192 sovereign countries', () => {
    expect(COUNTRIES.length).toBe(192);
    expect(SUPPORTED_COUNTRIES.length).toBe(192);
  });

  test('every country has unique 2-letter lowercase code, valid ISO-3, and numeric reporter ID', () => {
    const codes = new Set<string>();
    const iso3s = new Set<string>();
    const ids = new Set<number>();

    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[a-z]{2}$/);
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
      expect(typeof c.id).toBe('number');
      expect(c.id).toBeGreaterThan(0);

      expect(codes.has(c.code)).toBe(false);
      expect(iso3s.has(c.iso3)).toBe(false);
      expect(ids.has(c.id)).toBe(false);

      codes.add(c.code);
      iso3s.add(c.iso3);
      ids.add(c.id);
    }
  });

  test('COUNTRY_BY_CODE resolves correctly in O(1)', () => {
    expect(COUNTRY_BY_CODE.get('us')?.iso3).toBe('USA');
    expect(COUNTRY_BY_CODE.get('cn')?.iso3).toBe('CHN');
    expect(COUNTRY_BY_CODE.get('de')?.iso3).toBe('DEU');
    expect(COUNTRY_BY_CODE.get('ua')?.iso3).toBe('UKR');
  });

  test('COUNTRY_BY_ID resolves correctly in O(1)', () => {
    expect(COUNTRY_BY_ID.get(842)?.code).toBe('us');
    expect(COUNTRY_BY_ID.get(156)?.code).toBe('cn');
    expect(COUNTRY_BY_ID.get(276)?.code).toBe('de');
    expect(COUNTRY_BY_ID.get(804)?.code).toBe('ua');
  });

  test('COUNTRY_BY_ISO3 resolves correctly in O(1)', () => {
    expect(COUNTRY_BY_ISO3.get('USA')?.code).toBe('us');
    expect(COUNTRY_BY_ISO3.get('CHN')?.code).toBe('cn');
    expect(COUNTRY_BY_ISO3.get('DEU')?.code).toBe('de');
    expect(COUNTRY_BY_ISO3.get('UKR')?.code).toBe('ua');
  });
});

describe('Pipeline Lifecycle & Incremental Progression', () => {
  test('scenario: cache has 9 complete countries; pipeline detects country 10 (Canada) is missing and requires update', () => {
    const cachedCodes = ['us', 'cn', 'de', 'jp', 'gb', 'in', 'fr', 'ru', 'it'];
    const fakeCache: Record<string, RawCountryProfile> = {};

    for (const code of cachedCodes) {
      fakeCache[code] = createFullProfile(TEST_YEARS);
    }

    // Check all supported countries against cache
    const anyCountryNeedsUpdate = SUPPORTED_COUNTRIES.some((countryCode) => {
      const existing = fakeCache[countryCode];
      return !isCountryComplete(existing, TEST_YEARS);
    });

    // Country 10 (ca) is not in cache, so anyCountryNeedsUpdate MUST be true!
    expect(anyCountryNeedsUpdate).toBe(true);

    // Verify individual country skipping vs fetching
    const skipped: string[] = [];
    const fetched: string[] = [];

    for (const countryCode of SUPPORTED_COUNTRIES) {
      const existing = fakeCache[countryCode];
      const missing = detectMissingStreams(existing, TEST_YEARS);
      const hasMissing = missing.goods.length > 0 || missing.partners.length > 0 || missing.services.length > 0 || missing.needsImf;

      if (!hasMissing && existing) {
        skipped.push(countryCode);
      } else {
        fetched.push(countryCode);
      }
    }

    // The 9 complete countries must be skipped in 0ms
    expect(skipped).toEqual(cachedCodes);
    // Brazil (br) must be the very first country in the fetched queue
    expect(fetched[0]).toBe('br');
    // Total fetched must equal 192 - 9 = 183
    expect(fetched.length).toBe(192 - 9);
  });

  test('scenario: all 192 countries are complete; pipeline skips all fetching and only exports', () => {
    const fakeFullCache: Record<string, RawCountryProfile> = {};
    for (const code of SUPPORTED_COUNTRIES) {
      fakeFullCache[code] = createFullProfile(TEST_YEARS);
    }

    const anyCountryNeedsUpdate = SUPPORTED_COUNTRIES.some((countryCode) => {
      const existing = fakeFullCache[countryCode];
      return !isCountryComplete(existing, TEST_YEARS);
    });

    // Zero countries need updating!
    expect(anyCountryNeedsUpdate).toBe(false);
  });
});
