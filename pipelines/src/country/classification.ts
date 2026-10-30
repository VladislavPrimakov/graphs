import type { EbopsServiceCode, GoodsCategoryId, ServicesCategoryId, TradeCategoryId } from '@graphs/shared/types/country';

/** Structural mapping between the 10 goods macro category IDs and all 97 2-digit HS chapters. */
export const GOODS_MACRO_CHAPTERS: Record<GoodsCategoryId, string[]> = {
  ag: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
  mn: ['25', '26', '27'],
  ch: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40'],
  wd: ['44', '45', '46', '47', '48', '49'],
  tx: ['41', '42', '43', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67'],
  sg: ['68', '69', '70'],
  mt: ['71', '72', '73', '74', '75', '76', '78', '79', '80', '81', '82', '83'],
  mc: ['84', '85'],
  tr: ['86', '87', '88', '89'],
  mi: ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'],
};

/** Index mapping 2-digit HS chapter code to parent goods macro category ID. */
export const HS_TO_MACRO_MAP: Record<string, GoodsCategoryId> = {};
for (const [catId, chapters] of Object.entries(GOODS_MACRO_CHAPTERS) as [GoodsCategoryId, string[]][]) {
  for (const ch of chapters) {
    HS_TO_MACRO_MAP[ch] = catId;
  }
}

/** Complete list of standard 2-digit Harmonized System (HS-2) chapters with macro category linkage. */
export const HS2_CHAPTERS = Object.entries(HS_TO_MACRO_MAP)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, macroId]) => ({ code, macroId }));

/**
 * Normalization map converting all incoming UN Comtrade EBOPS codes
 * (EBOPS 2002 3-digit, EBOPS 2010 alpha codes, and EBOPS 2010 numeric codes)
 * to canonical 11 EBOPS 2002 3-digit codes.
 * Totals ('S', '200', 'TOTAL') and detailed sub-categories are intentionally excluded to prevent double-counting.
 */
export const EBOPS_NORMALIZATION_MAP: Record<string, EbopsServiceCode> = {
  // EBOPS 2002 canonical (11 parent items)
  '205': '205',
  '236': '236',
  '245': '245',
  '249': '249',
  '253': '253',
  '260': '260',
  '262': '262',
  '266': '266',
  '268': '268',
  '287': '287',
  '291': '291',

  // EBOPS 2010 alpha (12 parent items)
  SC: '205', // Transport
  SD: '236', // Travel
  SE: '249', // Construction
  SF: '253', // Insurance
  SG: '260', // Financial
  SH: '266', // Intellectual property
  SI: '262', // Telecom, computer, info
  SJ: '268', // Other business
  SK: '287', // Personal, cultural, recreational
  SL: '291', // Government
  SA: '268', // Manufacturing services on physical inputs
  SB: '268', // Maintenance and repair services

  // EBOPS 2010 numeric (12 parent items)
  '3': '205',
  '4': '236',
  '5': '249',
  '6': '253',
  '7': '260',
  '8': '266',
  '9': '262',
  '10': '268',
  '11': '287',
  '12': '291',
  '1': '268',
  '2': '268',
};

/** Structural mapping between the 7 services macro category IDs and canonical 11 EBOPS 2002 service codes. */
export const SERVICES_MACRO_CODES: Record<ServicesCategoryId, EbopsServiceCode[]> = {
  ts: ['205'],
  tv: ['236'],
  it: ['245', '262'],
  fn: ['253', '260'],
  ip: ['266'],
  bs: ['268'],
  os: ['249', '287', '291'],
};

/** Index mapping UN Comtrade EBOPS service codes (canonical and normalized) to parent services macro category ID. */
export const EBOPS_TO_SERVICES_MAP: Record<string, ServicesCategoryId> = {};
for (const [catId, codes] of Object.entries(SERVICES_MACRO_CODES) as [ServicesCategoryId, EbopsServiceCode[]][]) {
  for (const code of codes) {
    EBOPS_TO_SERVICES_MAP[code] = catId;
  }
}
for (const [rawCode, canonicalCode] of Object.entries(EBOPS_NORMALIZATION_MAP)) {
  const catId = EBOPS_TO_SERVICES_MAP[canonicalCode];
  if (catId) {
    EBOPS_TO_SERVICES_MAP[rawCode] = catId;
  }
}

/** Complete structural grouping of all detailed codes under each macro category for toolbar metadata. */
export const COUNTRY_CATEGORIES_META: Record<TradeCategoryId, string[]> = {
  ...GOODS_MACRO_CHAPTERS,
  ...SERVICES_MACRO_CODES,
};
