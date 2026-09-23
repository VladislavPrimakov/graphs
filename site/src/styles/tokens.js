/**
 * Unified Design Tokens for Graphs & Analytics
 * Shared single source of truth for:
 * 1. Tailwind CSS Theme configuration
 * 2. ECharts chart options and visual palettes
 * 3. UI Component styling across Astro templates
 */

export const themeColors = {
  // Surfaces & Backgrounds
  surface: {
    base: '#020617',      // slate-950 (site background)
    card: '#0f172a',      // slate-900 (cards, headers, tooltips)
    elevated: '#1e293b',  // slate-800 (nested cards, tags, controls)
    overlay: 'rgba(15, 23, 42, 0.95)',
  },

  // Borders & Dividers
  border: {
    subtle: '#1e293b',    // slate-800 (card borders, grid lines)
    muted: '#334155',     // slate-700 (hover borders, axis lines, tooltip borders)
    active: '#475569',    // slate-600
  },

  // Typography / Text Content
  text: {
    primary: '#f8fafc',   // slate-50 (headings, key values)
    secondary: '#cbd5e1', // slate-300 (descriptions, legends)
    muted: '#94a3b8',     // slate-400 (axis labels, subtexts, dates)
    dim: '#64748b',       // slate-500 (footnotes, placeholders)
  },

  // Interactive & Accents
  accent: {
    primary: '#38bdf8',   // sky-400
    hover: '#7dd3fc',     // sky-300
    glow: 'rgba(56, 189, 248, 0.15)',
    blue: '#3b82f6',      // blue-500
    blueLight: '#93c5fd', // blue-300
    indigo: '#6366f1',    // indigo-500
    rose: '#f43f5e',      // rose-500
    roseGlow: 'rgba(244, 63, 94, 0.15)',
    orange: '#fb923c',    // orange-400
  },

  // Semantic Status
  status: {
    success: '#10b981',      // emerald-500
    successLight: '#4ade80', // emerald-400
    warning: '#f59e0b',      // amber-500
    danger: '#ef4444',       // red-500
    dangerLight: '#fca5a5',  // red-300
    dangerMuted: '#f87171',  // red-400
    info: '#06b6d4',         // cyan-500
  },

  // Ukraine State Budget & Economic Sector Palette
  budget: {
    defense: '#b83a3a',      // Crimson: Defense Expenditures
    otherExp: '#475569',     // Slate: Other Expenditures
    domesticRev: '#16a34a',  // Green: Domestic Tax Revenues
    grants: '#d97706',       // Amber: External Grants
    loans: '#facc15',        // Yellow: External Loans
    debt: '#64748b',         // Slate/Steel: External Debt
  },

  // Unified Country & Regional Colors (Zero Duplicate Aliases)
  country: {
    USA: '#2563eb',         // Royal Blue
    China: '#dc2626',       // Crimson Red
    Europe: '#d97706',      // Warm Amber / Gold
    Russia: '#9333ea',      // Purple
    Japan: '#0d9488',       // Teal
    India: '#16a34a',       // Green
    'South Korea': '#0891b2', // Cyan
    Taiwan: '#c026d3',      // Fuchsia
    Others: '#94a3b8',      // Slate Muted
  },
};

export const COUNTRY_COLORS = themeColors.country;
export const DEFAULT_COUNTRY_COLOR = themeColors.country.Others;

export function getCountryColor(country) {
  return themeColors.country[country] || DEFAULT_COUNTRY_COLOR;
}

/**
 * Standard base styling options for Apache ECharts
 */
export const CHART_BASE_THEME = {
  backgroundColor: 'transparent',
  title: {
    textStyle: {
      color: themeColors.text.primary,
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    subtextStyle: {
      color: themeColors.text.muted,
      fontSize: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    itemGap: 6,
    left: 'center',
  },
  legend: {
    top: 54,
    left: 'center',
    textStyle: {
      color: themeColors.text.secondary,
      fontSize: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    itemGap: 16,
  },
  grid: {
    top: 100,
    left: '3%',
    right: '4%',
    bottom: '10%',
    containLabel: true,
  },
  xAxis: {
    axisLabel: {
      color: themeColors.text.secondary,
      fontSize: 12,
    },
    axisLine: {
      lineStyle: { color: themeColors.border.muted },
    },
  },
  yAxis: {
    nameTextStyle: {
      color: themeColors.text.muted,
      fontSize: 12,
      padding: [0, 0, 8, 0],
    },
    splitLine: {
      lineStyle: {
        color: themeColors.border.subtle,
        type: 'dashed',
      },
    },
    axisLabel: {
      color: themeColors.text.muted,
    },
  },
  tooltip: {
    confine: true,
    backgroundColor: themeColors.surface.overlay,
    borderColor: themeColors.border.muted,
    borderWidth: 1,
    padding: [10, 14],
    textStyle: {
      color: themeColors.text.primary,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); backdrop-filter: blur(8px); border-radius: 8px; pointer-events: none;',
  },
  dataZoom: {
    borderColor: themeColors.border.muted,
    fillerColor: themeColors.accent.glow,
    handleStyle: { color: themeColors.accent.primary },
    textStyle: { color: themeColors.text.muted },
  },
};

/**
 * Tag badge design tokens and Tailwind utility mappings.
 * Unified styling across project cards and page headers.
 */
export const tagStyles = {
  // Scope / Regional
  ua: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
  global: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  world: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  'air-defense': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  launches: 'bg-sky-500/10 text-sky-400 border-sky-500/25',

  // High-level Domains & Macro
  economy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  economic: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  budget: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  gdp: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  energy: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  industry: 'bg-teal-500/10 text-teal-400 border-teal-500/25',

  // Defense & Military
  war: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  uav: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  missiles: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  losses: 'bg-red-500/10 text-red-400 border-red-500/25',
  equipment: 'bg-orange-500/10 text-orange-400 border-orange-500/25',

  // Space Exploration
  space: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',

  // Fallback
  default: 'bg-surface-elevated text-content-secondary border-border-muted/60',
};

export function getTagClasses(tag) {
  const key = String(tag || '').toLowerCase().trim().replace(/[\s_]+/g, '-');
  return tagStyles[key] || tagStyles.default;
}
