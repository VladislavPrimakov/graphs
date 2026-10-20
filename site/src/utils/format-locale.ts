import type { Language } from './language';

/**
 * Historical sovereign states, regional trade customs unions, and non-ISO geographic aggregates
 * that cannot be resolved automatically via standard browser Intl.DisplayNames.
 */
export const HISTORICAL_AND_REGIONAL_NAMES: Record<Language, Record<string, string>> = {
  en: {
    // Statistical & regional aggregates
    AEC: 'Asia ex-China',
    ROW: 'Rest of World',
    OTHERS: 'Others',

    // Historical sovereign states & customs unions
    SUN: 'USSR',
    YUG: 'Yugoslavia',
    SCG: 'Serbia and Montenegro',
    CSK: 'Czechoslovakia',
    DDR: 'East Germany',
    ANT: 'Netherlands Antilles',
    ZA1: 'SACU (Southern Africa)',
    YMD: 'South Yemen',
    PUS: 'US Pacific Islands',
    PCI: 'Pacific Islands Trust',
    ATB: 'British Antarctic Territory',
  },
  ru: {
    // Statistical & regional aggregates
    AEC: 'Азия без Китая',
    ROW: 'Остальной мир',
    OTHERS: 'Прочие',

    // Historical sovereign states & customs unions
    SUN: 'СССР',
    YUG: 'Югославия',
    SCG: 'Сербия и Черногория',
    CSK: 'Чехословакия',
    DDR: 'ГДР',
    ANT: 'Нидерландские Антилы',
    ZA1: 'Таможенный союз ЮАР',
    YMD: 'Южный Йемен',
    PUS: 'Тихоокеанские о-ва США',
    PCI: 'Подопечная территория Тихоокеанские о-ва',
    ATB: 'Британская антарктическая территория',
  },
  uk: {
    // Statistical & regional aggregates
    AEC: 'Азія без Китаю',
    ROW: 'Решта світу',
    OTHERS: 'Інші',

    // Historical sovereign states & customs unions
    SUN: 'СРСР',
    YUG: 'Югославія',
    SCG: 'Сербія та Чорногорія',
    CSK: 'Чехословаччина',
    DDR: 'НДР',
    ANT: 'Нідерландські Антили',
    ZA1: 'Митний союз ПАР',
    YMD: 'Південний Ємен',
    PUS: 'Тихоокеанські о-ви США',
    PCI: 'Підопічна територія Тихоокеанські о-ви',
    ATB: 'Британська антарктична територія',
  },
  de: {
    // Statistical & regional aggregates
    AEC: 'Asien ohne China',
    ROW: 'Rest der Welt',
    OTHERS: 'Sonstige',

    // Historical sovereign states & customs unions
    SUN: 'UdSSR',
    YUG: 'Jugoslawien',
    SCG: 'Serbien und Montenegro',
    CSK: 'Tschechoslowakei',
    DDR: 'DDR (Ostdeutschland)',
    ANT: 'Niederländische Antillen',
    ZA1: 'Zollunion des Südlichen Afrika',
    YMD: 'Südjemen',
    PUS: 'US-Pazifikinseln',
    PCI: 'Treuhandgebiet Pazifische Inseln',
    ATB: 'Britisches Antarktis-Territorium',
  },
};

/** Resolves localized name for historical states, customs unions, or special aggregate codes. */
export function resolveAdditionalRegionName(lang: Language, regionCode?: string): string | undefined {
  if (!regionCode) return undefined;
  const upper = regionCode.toUpperCase();
  return HISTORICAL_AND_REGIONAL_NAMES[lang]?.[upper];
}
