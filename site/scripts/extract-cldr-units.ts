import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { type CldrLocaleUnits, type CldrUnitData, type CldrUnitsCollection, SUPPORTED_UNITS, type UnitDisplayStyle, type UnitIdentifier } from '../src/utils/format';
import { type Language, SUPPORTED_LANGUAGE_CODES } from '../src/utils/locales';

const require = createRequire(import.meta.url);
const SITE_DIR = resolve(import.meta.dirname, '..');
const OUTPUT_DIR = resolve(SITE_DIR, 'src/data/cldr');
const CACHE_FILE = resolve(OUTPUT_DIR, '.cache.json');

/** Custom domain-specific unit definitions not present in Unicode CLDR standard. */
const CUSTOM_UNITS: Record<Language, Record<UnitDisplayStyle, Partial<Record<UnitIdentifier, CldrUnitData>>>> = {
  en: {
    short: {
      'event-launch': {
        displayName: 'launch',
        perUnitPattern: '{0}/launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
    },
    long: {
      'event-launch': {
        displayName: 'launches',
        perUnitPattern: '{0} per launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'launch',
        perUnitPattern: '{0}/launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
    },
  },
  ru: {
    short: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
    },
    long: {
      'event-launch': {
        displayName: 'запуски',
        perUnitPattern: '{0} на запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
    },
  },
};

/** Resolves directory containing cldr-units-full package files. */
function getCldrPkgDir(): string {
  try {
    const pkgPath = require.resolve('cldr-units-full/package.json');
    return dirname(pkgPath);
  } catch {
    throw new Error('Failed to resolve cldr-units-full package. Ensure it is installed in dependencies.');
  }
}

/** Resolves version string from cldr-units-full package descriptor. */
function getCldrVersion(pkgDir: string): string {
  try {
    const pkgPath = resolve(pkgDir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      return String(pkg.version || 'unknown');
    }
  } catch {}
  return 'unknown';
}

/** Computes deterministic signature hash of extraction inputs for cache validation. */
function computeCacheKey(version: string): string {
  const hash = createHash('sha256');
  hash.update(version);
  hash.update(SUPPORTED_LANGUAGE_CODES.slice().sort().join(','));
  hash.update(SUPPORTED_UNITS.slice().sort().join(','));
  hash.update(JSON.stringify(CUSTOM_UNITS));
  return hash.digest('hex');
}

/** Extracts minimal subset of CLDR unit definitions for registered units. */
function extractUnitsForLanguage(pkgDir: string, lang: Language): CldrLocaleUnits {
  const filePath = resolve(pkgDir, `main/${lang}/units.json`);
  if (!existsSync(filePath)) {
    throw new Error(`CLDR units dataset missing for language: ${lang} at ${filePath}`);
  }

  const rawJson = JSON.parse(readFileSync(filePath, 'utf8'));
  const rawUnits = rawJson.main?.[lang]?.units;
  if (!rawUnits) {
    throw new Error(`Invalid CLDR units schema for language: ${lang}`);
  }

  const styles: UnitDisplayStyle[] = ['short', 'long', 'narrow'];
  const result: CldrLocaleUnits = { short: {}, long: {}, narrow: {} };

  for (const style of styles) {
    const styleSource = rawUnits[style] || {};
    const collection: CldrUnitsCollection = {};

    for (const unit of SUPPORTED_UNITS) {
      const customUnit = CUSTOM_UNITS[lang]?.[style]?.[unit];
      if (customUnit) {
        collection[unit] = customUnit;
        continue;
      }

      const unitSource = styleSource[unit];
      if (!unitSource) continue;

      const unitData: CldrUnitData = {
        displayName: unitSource.displayName,
      };

      if (unitSource.perUnitPattern) {
        unitData.perUnitPattern = unitSource.perUnitPattern;
      }

      for (const key of Object.keys(unitSource)) {
        if (key.startsWith('unitPattern-count-')) {
          unitData[key as `unitPattern-count-${string}`] = unitSource[key];
        }
      }

      collection[unit] = unitData;
    }

    result[style] = collection;
  }

  return result;
}

/** Main extraction orchestrator with hash-based caching. */
function run(): void {
  const pkgDir = getCldrPkgDir();
  const version = getCldrVersion(pkgDir);
  const cacheKey = computeCacheKey(version);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Validate cache
  let isCacheValid = false;
  if (existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      if (cached.key === cacheKey) {
        const allFilesExist = SUPPORTED_LANGUAGE_CODES.every((lang) => existsSync(resolve(OUTPUT_DIR, `${lang}.json`)));
        if (allFilesExist) {
          isCacheValid = true;
        }
      }
    } catch {}
  }

  if (isCacheValid) {
    return;
  }

  const startTime = performance.now();
  console.log(`[cldr] Extracting ${SUPPORTED_UNITS.length} units across ${SUPPORTED_LANGUAGE_CODES.length} languages...`);

  for (const lang of SUPPORTED_LANGUAGE_CODES) {
    const data = extractUnitsForLanguage(pkgDir, lang);
    const targetFile = resolve(OUTPUT_DIR, `${lang}.json`);
    writeFileSync(targetFile, JSON.stringify(data), 'utf8');
  }

  writeFileSync(
    CACHE_FILE,
    JSON.stringify({
      key: cacheKey,
      generatedAt: new Date().toISOString(),
      languages: SUPPORTED_LANGUAGE_CODES,
      units: SUPPORTED_UNITS,
    }),
    'utf8',
  );

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`[cldr] Extracted unit data into site/src/data/cldr/ in ${elapsed}ms.`);
}

run();
