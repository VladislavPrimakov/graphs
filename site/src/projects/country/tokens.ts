import type { TradeCategoryId } from '@graphs/types/country';

/** Macroeconomic budget and debt category colors. */
export const budgetColors = {
  gdp: '#2563eb',
  domesticRev: '#16a34a',
  totalExp: '#dc2626',
  govDebt: '#4f46e5',
  balance: '#38bdf8',
} as const;

/** International trade overview series colors. */
export const tradeColors = {
  exportTotal: '#3b82f6',
  importTotal: '#f97316',
  balanceLine: '#38bdf8',
  goodsTotal: '#10b981',
  servicesTotal: '#8b5cf6',
} as const;

/** 17 standardized trade macro category colors (10 goods + 7 services). */
export const tradeCategoryColors: Record<TradeCategoryId, string> = {
  agriculture: '#10b981',
  minerals: '#f59e0b',
  chemicals_plastics: '#8b5cf6',
  wood_paper: '#8d5b38',
  textiles_apparel: '#ec4899',
  stone_glass: '#78716c',
  metals: '#64748b',
  machinery_electronics: '#2563eb',
  transport: '#0284c7',
  misc_instruments: '#d946ef',
  services_it: '#6366f1',
  services_transport: '#0d9488',
  services_travel: '#f97316',
  services_financial: '#eab308',
  services_ip: '#a855f7',
  services_business: '#06b6d4',
  services_other: '#94a3b8',
};

/** High-contrast distinguishable categorical palette for detailed HS chapters and EBOPS service codes. */
const DETAILED_PALETTE = [
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#16a34a', // green-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#0284c7', // sky-600
  '#ca8a04', // yellow-600
  '#e11d48', // rose-600
  '#0d9488', // teal-600
  '#65a30d', // lime-600
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#22c55e', // green-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#0ea5e9', // sky-500
  '#eab308', // yellow-500
  '#f43f5e', // rose-500
  '#14b8a6', // teal-500
  '#84cc16', // lime-500
];

/** Resolves a deterministic, distinguishable color for any 2-digit HS chapter or 3-digit EBOPS code. */
export function getDetailedCategoryColor(code: string): string {
  const num = Number.parseInt(code, 10);
  if (!Number.isNaN(num)) {
    // Stepping by prime 11 distributes consecutive chapter numbers across distant hues
    const idx = (num * 11 + 7) % DETAILED_PALETTE.length;
    return DETAILED_PALETTE[idx];
  }
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return DETAILED_PALETTE[Math.abs(hash) % DETAILED_PALETTE.length];
}
