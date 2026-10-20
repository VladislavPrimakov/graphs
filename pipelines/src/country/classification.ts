import type { GoodsCategoryId, ServicesCategoryId, TradeCategoryId } from '@graphs/types/country';

/** Structural mapping between the 10 goods macro category IDs and all 97 2-digit HS chapters. */
export const GOODS_MACRO_CHAPTERS: Record<GoodsCategoryId, string[]> = {
  agriculture: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
  minerals: ['25', '26', '27'],
  chemicals_plastics: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40'],
  wood_paper: ['44', '45', '46', '47', '48', '49'],
  textiles_apparel: ['41', '42', '43', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67'],
  stone_glass: ['68', '69', '70'],
  metals: ['71', '72', '73', '74', '75', '76', '78', '79', '80', '81', '82', '83'],
  machinery_electronics: ['84', '85'],
  transport: ['86', '87', '88', '89'],
  misc_instruments: ['90', '91', '92', '93', '94', '95', '96', '97', '99'],
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

/** Structural mapping between the 7 services macro category IDs and UN Comtrade EBOPS 2002 3-digit codes. */
export const SERVICES_MACRO_CODES: Record<ServicesCategoryId, string[]> = {
  services_it: ['245', '262'],
  services_transport: ['205'],
  services_travel: ['236'],
  services_financial: ['253', '260'],
  services_ip: ['266'],
  services_business: ['268'],
  services_other: ['249', '287', '291'],
};

/** Index mapping UN Comtrade EBOPS 2002 3-digit service code to parent services macro category ID. */
export const EBOPS_TO_SERVICES_MAP: Record<string, ServicesCategoryId> = {};
for (const [catId, codes] of Object.entries(SERVICES_MACRO_CODES) as [ServicesCategoryId, string[]][]) {
  for (const code of codes) {
    EBOPS_TO_SERVICES_MAP[code] = catId;
  }
}

/** Complete structural grouping of all detailed codes under each macro category for toolbar metadata. */
export const COUNTRY_CATEGORIES_META: Record<TradeCategoryId, string[]> = {
  ...GOODS_MACRO_CHAPTERS,
  ...SERVICES_MACRO_CODES,
};
