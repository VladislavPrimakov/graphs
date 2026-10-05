import stringHash from 'string-hash';
import type { Language } from './locales';

/* -------------------------------------------------------------------------- */
/* 1. Measurement Units & CLDR Schemas                                        */
/* -------------------------------------------------------------------------- */

/** Canonical registry of measurement unit identifiers supported across frontend visualization dashboards. */
export const SUPPORTED_UNITS = [
  'mass-tonne',
  'mass-kilogram',
  'mass-gram',
  'length-meter',
  'length-kilometer',
  'energy-terawatt-hour',
  'energy-kilowatt-hour',
  'duration-day',
  'duration-month',
  'event-launch',
  'person',
] as const;

/** Canonical measurement unit identifier from Unicode CLDR or domain extensions. */
export type UnitIdentifier = (typeof SUPPORTED_UNITS)[number];

/** Canonical registry of denominator rate units supporting per-unit formatting ('{0}/unit' or '{0} per unit'). */
export const SUPPORTED_PER_UNITS = [
  'mass-kilogram',
  'mass-gram',
  'length-meter',
  'length-kilometer',
  'duration-day',
  'duration-month',
  'event-launch',
  'person',
] as const satisfies readonly UnitIdentifier[];

/** Unit identifier that supports denominator rate formatting via perUnitPattern. */
export type PerUnitIdentifier = (typeof SUPPORTED_PER_UNITS)[number];

/** Display format style for unit formatting: 'short' abbreviation, 'long' full word, or 'narrow'. @default 'short' */
export type UnitDisplayStyle = 'short' | 'long' | 'narrow';

/** Compact schema of localized unit data extracted from Unicode CLDR. */
export interface CldrUnitData {
  displayName: string;
  perUnitPattern?: string;
  [pattern: `unitPattern-count-${string}`]: string | undefined;
}

/** Mapping of unit identifiers to their localized unit definitions for a display style. */
export type CldrUnitsCollection = Partial<Record<UnitIdentifier, CldrUnitData>>;

/** Tri-style measurement unit patterns extracted per locale. */
export interface CldrLocaleUnits {
  short: CldrUnitsCollection;
  long: CldrUnitsCollection;
  narrow: CldrUnitsCollection;
}

/** In-memory cache for dynamically loaded CLDR unit datasets by language. */
const cldrCache = new Map<Language, CldrLocaleUnits>();

/** Resolves active CLDR unit dataset from cache for the requested language. */
function getCldrUnits(lang: Language): CldrLocaleUnits | undefined {
  return cldrCache.get(lang);
}

/* -------------------------------------------------------------------------- */
/* 2. Numeric, Monetary & Temporal Formatters                                 */
/* -------------------------------------------------------------------------- */

/** In-memory cache for Intl.NumberFormat instances to eliminate expensive ICU instance re-creation. */
const numberFormatCache = new Map<string, Intl.NumberFormat>();

/** Resolves or creates a cached Intl.NumberFormat instance for the requested language and options. */
function getNumberFormat(lang: Language, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = options ? `${lang}:${JSON.stringify(options)}` : lang;
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(lang, options);
    numberFormatCache.set(key, fmt);
  }
  return fmt;
}

/** In-memory cache for Intl.DateTimeFormat instances to eliminate expensive ICU instance re-creation. */
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

/** Resolves or creates a cached Intl.DateTimeFormat instance for the requested language and options. */
function getDateTimeFormat(lang: Language, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = options ? `${lang}:${JSON.stringify(options)}` : lang;
  let fmt = dateTimeFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(lang, options);
    dateTimeFormatCache.set(key, fmt);
  }
  return fmt;
}

/** Formats a numeric value with locale-specific grouping and decimal separators (default: up to 1 fraction digit, integers without trailing zeroes). */
function formatNumber(lang: Language, value: number, options?: Intl.NumberFormatOptions): string {
  return getNumberFormat(lang, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

/** Formats a monetary amount into a localized currency string. */
function formatCurrency(lang: Language, amount: number, currency = 'USD', options?: Intl.NumberFormatOptions): string {
  return getNumberFormat(lang, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
}

/** Formats a percentage value (0..100) according to locale conventions. */
function formatPercent(lang: Language, value: number, options?: Intl.NumberFormatOptions): string {
  return getNumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    ...options,
  }).format(value / 100);
}

/**
 * Formats a normalized ratio between two quantities (or a single precomputed ratio value).
 * Returns empty string if non-positive.
 * Formats as `X : 1` when a >= b, or `1 : X` when b > a.
 */
export function formatRatio(lang: Language, a: number, b = 1, digits = 1): string {
  if (a <= 0 || b <= 0 || Number.isNaN(a) || Number.isNaN(b)) return '';
  const raw = a >= b ? a / b : b / a;
  const numStr = formatNumber(lang, raw, { minimumFractionDigits: 0, maximumFractionDigits: digits });
  return a >= b ? `${numStr} : 1` : `1 : ${numStr}`;
}

/** Formats an ISO date string or Date instance into a localized date string. */
function formatDate(lang: Language, date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return getDateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(d);
}

/** Formats a numeric value into compact localized notation (e.g., 1.5M, 1,5 млн). */
function formatCompactNumber(lang: Language, value: number, options?: Intl.NumberFormatOptions): string {
  return getNumberFormat(lang, {
    notation: 'compact',
    compactDisplay: 'short',
    ...options,
  }).format(value);
}

const DECADE_FORMATTERS: Record<Language, (decade: string) => string> = {
  en: (decade) => decade,
  ru: (decade) => decade.replace(/s$/, '-е'),
  uk: (decade) => decade.replace(/s$/, '-ті'),
  de: (decade) => decade.replace(/s$/, 'er'),
};

/** Formats a decade label according to localized language conventions. */
function formatDecade(lang: Language, decade: string): string {
  return DECADE_FORMATTERS[lang](decade);
}

/** Options for localized order-of-magnitude scale formatting. */
export interface FormatScaleOptions {
  /** Display format style: 'short' abbreviation (e.g. 'B', 'млрд') or 'long' word (e.g. 'billion', 'миллиард'). @default 'short' */
  style?: 'short' | 'long';
  /** Whether to capitalize the first letter. @default true */
  capitalize?: boolean;
}

/**
 * Resolves a localized scale or order-of-magnitude word/symbol (e.g. 1e9 -> 'Млрд' / 'B', 1e12 -> 'Трлн' / 'T')
 * via native browser Intl.NumberFormat token parts (ECMA-402 compact notation).
 */
function formatScale(lang: Language, value: number, options?: FormatScaleOptions): string {
  const { style = 'short', capitalize = true } = options || {};
  const parts = getNumberFormat(lang, { notation: 'compact', compactDisplay: style }).formatToParts(value);
  const str = parts.find((p) => p.type === 'compact')?.value ?? '';
  return capitalize && str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/* -------------------------------------------------------------------------- */
/* 3. Measurement Unit & Rate Formatters (Unicode CLDR)                       */
/* -------------------------------------------------------------------------- */

/** Options for localized measurement unit formatting. */
export interface FormatUnitOptions {
  /** Unit display format: 'short' abbreviation (e.g. 't', 'kg') or 'long' word (e.g. 'metric tons', 'килограммов'). @default 'short' */
  style?: UnitDisplayStyle;
  /** Fixed number of decimal fraction digits. */
  digits?: number;
}

/** Dynamic registry cache of Intl.PluralRules instances per requested locale. */
const pluralRulesCache = new Map<Language, Intl.PluralRules>();

/** Returns or creates an Intl.PluralRules instance for the specified language. */
function getPluralRules(lang: Language): Intl.PluralRules {
  let pr = pluralRulesCache.get(lang);
  if (!pr) {
    pr = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, pr);
  }
  return pr;
}

/**
 * Formats a numeric value with a localized measurement unit according to Unicode CLDR conventions.
 * Resolves plural patterns ('one', 'few', 'many', 'other') directly from the pre-extracted CLDR dataset.
 */
function formatUnit(lang: Language, value: number, unit: UnitIdentifier, options?: FormatUnitOptions): string {
  const { style = 'short', digits } = options || {};
  const cldr = getCldrUnits(lang);
  const numStr = formatNumber(lang, value, digits !== undefined ? { maximumFractionDigits: digits } : undefined);

  if (!cldr) return `${numStr} ${unit}`;

  const unitData = cldr[style][unit];
  if (!unitData) return `${numStr} ${unit}`;

  const pr = getPluralRules(lang);
  const rule = pr.select(value);
  const pattern = unitData[`unitPattern-count-${rule}`] || unitData['unitPattern-count-other']!;
  return pattern.replace('{0}', numStr);
}

/** Options for localized measurement unit name resolution. */
export interface FormatUnitNameOptions {
  /** Display format style: 'short' abbreviation (e.g. 't', 'kg') or 'long' full name (e.g. 'metric tons', 'тонны'). @default 'short' */
  style?: UnitDisplayStyle;
  /** Whether to capitalize the first letter. Defaults to true for 'long' style, false for 'short' style. */
  capitalize?: boolean;
}

/** Resolves the standalone localized display name or abbreviation of a measurement unit directly from Unicode CLDR. */
function formatUnitName(lang: Language, unit: UnitIdentifier, options?: FormatUnitNameOptions): string {
  const { style = 'short', capitalize = style === 'long' } = options || {};
  const cldr = getCldrUnits(lang);
  if (!cldr) return unit;

  const rawName = cldr[style][unit]?.displayName;
  if (!rawName) return unit;
  return capitalize ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : rawName;
}

/** Options for localized rate/per-unit formatting. */
export interface FormatPerUnitOptions {
  /** Unit display format: 'short' abbreviation (e.g. '{0}/kg') or 'long' word (e.g. '{0} per kilogram'). @default 'short' */
  style?: UnitDisplayStyle;
}

/**
 * Formats a formatted prefix (e.g., currency, number, or unit name) with a rate denominator unit
 * using Unicode CLDR perUnitPattern (e.g. '$1,200/kg' or 'kg/launch').
 */
function formatPerUnit(lang: Language, value: string | number, unit: PerUnitIdentifier, options?: FormatPerUnitOptions): string {
  const { style = 'short' } = options || {};
  const cldr = getCldrUnits(lang);
  const valStr = typeof value === 'number' ? formatNumber(lang, value) : value;
  if (!cldr) return `${valStr}/${unit}`;
  const pattern = cldr[style][unit]?.perUnitPattern;
  if (!pattern) return `${valStr}/${unit}`;
  return pattern.replace('{0}', valStr);
}

/* -------------------------------------------------------------------------- */
/* 4. Geographic Regions & Brand Colors                                       */
/* -------------------------------------------------------------------------- */

/** Standard pinned colors for sovereign nations, trading partners, and regions typed by ISO 3166-1 alpha-2 / UN codes. */
const REGION_COLORS: Record<string, string> = {
  // Global & Space Powers
  US: '#2563eb', // USA
  CN: '#dc2626', // China
  RU: '#9333ea', // Russia
  JP: '#0d9488', // Japan
  IN: '#16a34a', // India
  KR: '#0891b2', // South Korea
  TW: '#c026d3', // Taiwan
  NZ: '#10b981', // New Zealand
  IL: '#0284c7', // Israel
  IR: '#f43f5e', // Iran
  AU: '#eab308', // Australia

  // Supranational & Regional
  EU: '#8b5cf6', // European Union
  AEC: '#10b981', // Asia ex-China
  ROW: '#94a3b8', // Rest of World

  // Key European & Trade Partners
  PL: '#0284c7', // Poland
  DE: '#eab308', // Germany
  TR: '#14b8a6', // Turkey
  RO: '#8b5cf6', // Romania
  ES: '#f97316', // Spain
  IT: '#10b981', // Italy
  NL: '#d97706', // Netherlands
  BG: '#06b6d4', // Bulgaria
  CZ: '#6366f1', // Czech Republic
  UA: '#38bdf8', // Ukraine
  GB: '#4f46e5', // United Kingdom
};

/** Default fallback color for unclassified, rest-of-world, or aggregate entities. */
const DEFAULT_REGION_COLOR = '#94a3b8';

/** Deterministic categorical palette for dynamic region assignment in dark theme. */
const DYNAMIC_PALETTE = [
  '#0284c7', // sky-600
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#e11d48', // rose-600
  '#3b82f6', // blue-500
];

/** Dynamic registry cache of Intl.DisplayNames instances per requested locale. */
const displayNamesCache = new Map<Language, Intl.DisplayNames>();

/** Returns or creates an Intl.DisplayNames instance for region formatting in the requested locale. */
function getRegionDisplayNames(lang: Language): Intl.DisplayNames {
  let dn = displayNamesCache.get(lang);
  if (!dn) {
    dn = new Intl.DisplayNames(lang, { type: 'region', style: 'short' });
    displayNamesCache.set(lang, dn);
  }
  return dn;
}

const REGIONAL_NAMES: Record<Language, Record<string, string>> = {
  en: {
    AEC: 'Asia ex-China',
    ROW: 'Rest of World',
  },
  ru: {
    AEC: 'Азия без Китая',
    ROW: 'Остальной мир',
  },
  uk: {
    AEC: 'Азія без Китаю',
    ROW: 'Решта світу',
  },
  de: {
    AEC: 'Asien ohne China',
    ROW: 'Rest der Welt',
  },
};

/** Resolves localized country or region name via native browser Intl.DisplayNames in the requested locale with regional overrides. */
function getLocalizedRegionName(lang: Language, regionCode?: string): string {
  if (!regionCode) return '';
  const alias = REGIONAL_NAMES[lang]?.[regionCode];
  if (alias) return alias;

  try {
    const dn = getRegionDisplayNames(lang);
    return dn.of(regionCode) || regionCode;
  } catch {
    return regionCode;
  }
}

/**
 * Resolves a standardized brand hex color code for any sovereign nation or economic region.
 * Checks curated pinned color map first, then falls back to a deterministic palette hash.
 */
function getRegionColor(regionCode?: string): string {
  if (!regionCode) {
    return DEFAULT_REGION_COLOR;
  }
  if (REGION_COLORS[regionCode]) {
    return REGION_COLORS[regionCode];
  }

  const idx = stringHash(regionCode) % DYNAMIC_PALETTE.length;
  return DYNAMIC_PALETTE[idx];
}

/* -------------------------------------------------------------------------- */
/* 5. Pre-Bound Localization Factory (`createFormat`)                         */
/* -------------------------------------------------------------------------- */

/** Pre-bound localized formatters for concise calls without passing `lang` repeatedly. */
export interface LocalizedFormatters {
  /** Formats general numbers (default: up to 1 fraction digit, integers without trailing zeroes). */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Formats monetary currency amount. */
  currency: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  /** Formats percentage from a 0..100 numeric value. */
  percent: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Formats date to localized string. */
  date: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  /** Formats compact number (e.g. 1.5M). */
  compact: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Formats decade label (e.g. 1960s -> 1960-е). */
  decade: (decade: string) => string;
  /** Resolves localized country or region name. */
  region: (code: string | undefined) => string;
  /** Resolves standardized color for a country or region code. */
  regionColor: (code?: string) => string;
  /** Resolves localized order-of-magnitude unit or word (e.g. 1e9 -> 'Млрд' / 'B', or with style: 'long' -> 'Миллиард' / 'Billion'). */
  scale: (value: number, options?: FormatScaleOptions) => string;
  /** Formats a numeric value with a localized unit (default style: 'short'). */
  unit: (value: number, unit: UnitIdentifier, options?: FormatUnitOptions) => string;
  /** Resolves the standalone localized display name or abbreviation of a measurement unit (default style: 'short'). */
  unitName: (unit: UnitIdentifier, options?: FormatUnitNameOptions) => string;
  /** Formats a prefix value (currency, number, or unit name) with a rate denominator unit (e.g. '$1,520/kg', 'kg/launch'). */
  per: (value: string | number, unit: PerUnitIdentifier, options?: FormatPerUnitOptions) => string;
  /** Formats a ratio between two quantities (or a single precomputed ratio) as 'X : 1' or '1 : X'. */
  ratio: (a: number, b?: number, digits?: number) => string;
}

/** Creates a suite of pre-bound formatting functions for the specified target language and optional CLDR data. */
export function createFormat(lang: Language, cldr?: CldrLocaleUnits): LocalizedFormatters {
  if (cldr) {
    cldrCache.set(lang, cldr);
  }
  return {
    number: (value, options) => formatNumber(lang, value, options),
    currency: (amount, currency = 'USD', options) => formatCurrency(lang, amount, currency, options),
    percent: (value, options) => formatPercent(lang, value, options),
    date: (date, options) => formatDate(lang, date, options),
    compact: (value, options) => formatCompactNumber(lang, value, options),
    decade: (decade) => formatDecade(lang, decade),
    region: (code) => getLocalizedRegionName(lang, code),
    regionColor: (code) => getRegionColor(code),
    scale: (value, options) => formatScale(lang, value, options),
    unit: (value, unit, options) => formatUnit(lang, value, unit, options),
    unitName: (unit, options) => formatUnitName(lang, unit, options),
    per: (value, unit, options) => formatPerUnit(lang, value, unit, options),
    ratio: (a, b = 1, digits = 1) => formatRatio(lang, a, b, digits),
  };
}
