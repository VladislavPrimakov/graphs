import { describe, expect, test } from 'bun:test';
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_BY_ID, COUNTRY_BY_ISO3, SUPPORTED_COUNTRIES } from './countries';
import { BATCH_SIZE_SERVICES_COUNTRIES, buildProductionProfile, CHUNK_SIZE, chunkArray, chunkYears, detectMissingStreams, isCountryComplete, type RawCountryProfile, type RawYearData } from './index';

const TEST_YEARS = [2020, 2021, 2022, 2023, 2024];

function createFullYearData(year = 2023): RawYearData {
  return {
    goodsExports: { '01': 1.5, '84': 10.2 },
    servicesExports: { '205': 12.3, '262': 8.9 },
    servicesImports: { '205': 8.1, '262': 4.5 },
    partnerGoodsExports: {
      ca: { '01': 1.5, '84': 10.2 },
      mx: { '84': 5.0 },
    },
    goodsChecksum: 2024102002,
    servicesChecksum: 2024091501,
    ngdpd: 100 + year,
    rpch: 2.5,
    dpc: 50000,
    pppgdp: 120 + year,
    gx: 45.0,
    ggr: 42.0,
    ggxcnl: -3.0,
    ggxwdg: 65.0,
    pcpipch: 2.1,
    lur: 4.0,
    bca: 1.5,
  };
}

function createFullProfile(years: number[] = TEST_YEARS): RawCountryProfile {
  const yearsMap: Record<string, RawYearData> = {};
  for (const y of years) {
    yearsMap[String(y)] = createFullYearData(y);
  }
  return {
    code: 'us',
    years: yearsMap,
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
    // Delete goodsExports for 2023 and partnerGoodsExports for 2024
    delete profile.years['2023'].goodsExports;
    delete profile.years['2024'].partnerGoodsExports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([2023, 2024]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 4: missing partial years for bilateral partner goods triggers unified goods refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.years['2021'].partnerGoodsExports;
    delete profile.years['2022'].partnerGoodsExports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([2021, 2022]);
    expect(missing.services).toEqual([]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 5: missing partial years for commercial services triggers services refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.years['2020'].servicesExports;
    delete profile.years['2024'].servicesExports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.services).toEqual([2020, 2024]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 5b: missing partial years for commercial services imports triggers services refetch', () => {
    const profile = createFullProfile(TEST_YEARS);
    delete profile.years['2022'].servicesImports;

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.goods).toEqual([]);
    expect(missing.services).toEqual([2022]);
    expect(missing.needsImf).toBe(false);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 6: missing nominal GDP indicator flags needsImf', () => {
    const profile = createFullProfile(TEST_YEARS);
    for (const y of Object.values(profile.years)) {
      delete y.ngdpd;
    }

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
    for (const y of Object.values(profile.years)) {
      y.ngdpd = null;
    }

    const missing = detectMissingStreams(profile, TEST_YEARS);
    expect(missing.needsImf).toBe(true);
    expect(isCountryComplete(profile, TEST_YEARS)).toBe(false);
  });

  test('condition 10: non-existent upstream catalog years are skipped upfront (no futile queries)', () => {
    // Upstream catalog only has datasets for 2022 and 2023 for reporter 842
    const catalog = {
      goodsChecksums: new Map<string, number>([
        ['842:2022', 101],
        ['842:2023', 102],
      ]),
      servicesChecksums: new Map<string, number>([['842:2022', 201]]),
    };

    // Brand new country with no data in cache
    const missing = detectMissingStreams(undefined, TEST_YEARS, 842, catalog);
    // TEST_YEARS is [2020, 2021, 2022, 2023, 2024], but only 2022 and 2023 exist upstream!
    expect(missing.goods).toEqual([2022, 2023]);
    expect(missing.services).toEqual([2022]);
  });

  test('condition 11: IMF WEO version change in metadata invalidates macro cache globally', () => {
    const profile = createFullProfile(TEST_YEARS);
    const catalog = {
      goodsChecksums: new Map<string, number>(),
      servicesChecksums: new Map<string, number>(),
      imfLastModified: '2026-10-15T12:00:00Z',
    };

    // When cached timestamp matches upstream catalog: no refetch needed
    const upToDate = detectMissingStreams(profile, TEST_YEARS, 842, catalog, '2026-10-15T12:00:00Z');
    expect(upToDate.needsImf).toBe(false);

    // When upstream timestamp is newer than cached timestamp: flags needsImf
    const outdated = detectMissingStreams(profile, TEST_YEARS, 842, catalog, '2026-04-10T12:00:00Z');
    expect(outdated.needsImf).toBe(true);
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

  test('chunkArray batches 192 countries by BATCH_SIZE_SERVICES_COUNTRIES (40) into 5 batches', () => {
    expect(BATCH_SIZE_SERVICES_COUNTRIES).toBe(40);
    const countryBatches = chunkArray(COUNTRIES, BATCH_SIZE_SERVICES_COUNTRIES);
    expect(countryBatches.length).toBe(5);
    expect(countryBatches[0].length).toBe(40);
    expect(countryBatches[1].length).toBe(40);
    expect(countryBatches[2].length).toBe(40);
    expect(countryBatches[3].length).toBe(40);
    expect(countryBatches[4].length).toBe(32);
    expect(countryBatches.flat().length).toBe(192);
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

describe('Production Profile Generator & Symmetrical Imports (buildProductionProfile)', () => {
  test('reconstructs symmetrical imports from mirror partner exports', () => {
    // Country A (US) exports 10.0 billion of chapter 84 to Country B (CN) in 2023
    // Country B (CN) exports 50.0 billion of chapter 85 to Country A (US) in 2023
    const usProfile: RawCountryProfile = {
      code: 'us',
      years: {
        '2023': {
          goodsExports: { '84': 10.0 },
          partnerGoodsExports: {
            cn: { '84': 10.0 },
          },
          ngdpd: 27000,
        },
      },
    };

    const cnProfile: RawCountryProfile = {
      code: 'cn',
      years: {
        '2023': {
          goodsExports: { '85': 50.0 },
          partnerGoodsExports: {
            us: { '85': 50.0 },
          },
          ngdpd: 17000,
        },
      },
    };

    const all = { us: usProfile, cn: cnProfile };

    const usProd = buildProductionProfile(usProfile, all);
    const cnProd = buildProductionProfile(cnProfile, all);

    // US goods export in 2023 is 10.0
    expect(usProd.timeline[0].exports.goods).toBe(10.0);
    // US goods import in 2023 must equal China's export to US (50.0)
    expect(usProd.timeline[0].imports.goods).toBe(50.0);

    // China goods export in 2023 is 50.0
    expect(cnProd.timeline[0].exports.goods).toBe(50.0);
    // China goods import in 2023 must equal US export to China (10.0)
    expect(cnProd.timeline[0].imports.goods).toBe(10.0);

    // Verify US bilateral partner imports list CN with 50.0
    expect(usProd.timeline[0].imports.partners.CN?.total).toBe(50.0);

    // Verify China bilateral partner imports list US with 10.0
    expect(cnProd.timeline[0].imports.partners.US?.total).toBe(10.0);

    // Verify detailed trade breakdowns by partner and category for US exports to CN
    expect(usProd.timeline[0].exports.partners.CN?.macro.mc).toBe(10.0);
    expect(usProd.timeline[0].exports.partners.CN?.detailed['84']).toBe(10.0);

    // Verify symmetrical detailed trade breakdowns for US imports from CN
    expect(usProd.timeline[0].imports.partners.CN?.macro.mc).toBe(50.0);
    expect(usProd.timeline[0].imports.partners.CN?.detailed['85']).toBe(50.0);

    // Symmetrically for China: exports to US
    expect(cnProd.timeline[0].exports.partners.US?.macro.mc).toBe(50.0);
    expect(cnProd.timeline[0].exports.partners.US?.detailed['85']).toBe(50.0);

    // Symmetrically for China: imports from US
    expect(cnProd.timeline[0].imports.partners.US?.macro.mc).toBe(10.0);
    expect(cnProd.timeline[0].imports.partners.US?.detailed['84']).toBe(10.0);
  });

  test('calculates multi-category partner breakdowns with descending sort', () => {
    const rawProfile: RawCountryProfile = {
      code: 'us',
      years: {
        '2023': {
          goodsExports: { '01': 1.0, '02': 3.0, '84': 6.0 },
          partnerGoodsExports: {
            ca: { '01': 1.0, '02': 3.0, '84': 6.0 },
          },
          ngdpd: 27000,
        },
      },
    };

    const prod = buildProductionProfile(rawProfile);
    const ca = prod.timeline[0].exports.partners.CA;

    expect(ca).toBeDefined();
    expect(ca.total).toBe(10.0);

    // Total = 10.0B
    // Machinery (ch 84): 6.0B
    // Agriculture (ch 01 + ch 02): 4.0B
    expect(ca.macro.mc).toBe(6.0);
    expect(ca.macro.ag).toBe(4.0);

    // Detailed chapters
    expect(ca.detailed['84']).toBe(6.0);
    expect(ca.detailed['02']).toBe(3.0);
    expect(ca.detailed['01']).toBe(1.0);

    // Verify descending sort order of keys
    expect(Object.keys(ca.macro)).toEqual(['mc', 'ag']);
  });

  test('all timeline records match consecutive years and valid unified flows', () => {
    const profile = createFullProfile([2021, 2022, 2023]);
    const prod = buildProductionProfile(profile, { us: profile });

    expect(prod.years).toEqual([2021, 2022, 2023]);
    expect(prod.timeline.length).toBe(3);

    const y0 = prod.timeline[0];
    expect(y0.year).toBe(2021);
    expect(y0.exports.goods).toBe(11.7); // 1.5 + 10.2
    expect(y0.exports.services).toBe(21.2); // 12.3 + 8.9
    expect(y0.imports.services).toBe(12.6); // 8.1 + 4.5
    expect(y0.exports.total).toBe(32.9); // 11.7 + 21.2

    // Verify services categories in detailed and macro
    expect(y0.imports.detailed['205']).toBeDefined();
    expect(y0.imports.detailed['262']).toBeDefined();
    expect(y0.imports.macro.ts).toBeDefined();
    expect(y0.imports.macro.it).toBeDefined();

    expect(prod.activePartners.length).toBeGreaterThan(0);
    expect(prod.activeMacro.length).toBeGreaterThan(0);
    expect(prod.activeDetailed.length).toBeGreaterThan(0);

    expect(y0.macro.gdpNominalUsd).toBe(2121);
    expect(y0.macro.gdpRealGrowthYoy).toBe(2.5);
    expect(y0.macro.govExpenditurePctGdp).toBe(45.0);
    expect(y0.macro.govRevenuePctGdp).toBe(42.0);
    expect(y0.macro.govDebtPctGdp).toBe(65.0);
    expect(y0.macro.growth).toBeDefined();
  });
});
