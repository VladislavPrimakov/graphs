import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

/**
 * Resolves a standardized ISO 3166-1 alpha-2 code or regional identifier (e.g. 'US', 'PL', 'CN', 'EU', 'Others')
 * from raw source country names, 3-letter codes, or 2-letter codes across all data pipelines.
 */
export function resolveRegionCode(nameOrCode?: string): string {
  if (!nameOrCode) return '';
  const trimmed = nameOrCode.trim();
  const upper = trimmed.toUpperCase();

  // 1. Accounting/statistical aggregate buckets
  if (upper === 'OTHERS' || upper === 'OTHER') {
    return 'Others';
  }

  // 2. Specific regional aliases and UN trade nomenclature variants
  if (upper === 'EU' || upper === 'EUU' || upper === 'EUROPE' || upper === 'EUROPEAN UNION') {
    return 'EU';
  }
  if (upper === 'REPUBLIC OF MOLDOVA' || upper === 'MOLDOVA') return 'MD';
  if (upper === 'UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND') return 'GB';
  if (upper === 'VIET NAM') return 'VN';
  if (upper === 'S19') return 'TW';

  // 3. ISO 3166-1 Alpha-3 conversion (e.g. 'USA' -> 'US', 'CHN' -> 'CN', 'DEU' -> 'DE', 'KAZ' -> 'KZ')
  if (trimmed.length === 3) {
    const fromAlpha3 = countries.alpha3ToAlpha2(upper);
    if (fromAlpha3) return fromAlpha3;
  }

  // 4. ISO 3166-1 Alpha-2 direct validation (e.g. 'US', 'PL', 'UA')
  if (trimmed.length === 2 && countries.isValid(upper)) {
    return upper;
  }

  // 5. Full country name lookup via i18n-iso-countries (e.g. 'United States' -> 'US', 'Poland' -> 'PL')
  const alpha2 = countries.getAlpha2Code(trimmed, 'en');
  if (alpha2) return alpha2;

  // 6. Fallback to raw trimmed string
  return trimmed;
}
