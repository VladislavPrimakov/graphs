import type { DataZoomComponentOption, GridComponentOption, LegendComponentOption, TitleComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption } from '@/types';

/** Single Source of Truth (SSoT) Design Tokens for Graphs & Analytics UI and canvas charts. */
export const themeColors = {
  surface: {
    base: '#020617',
    card: '#0f172a',
    elevated: '#1e293b',
    overlay: 'rgba(15, 23, 42, 0.95)',
  },
  border: {
    subtle: '#1e293b',
    muted: '#334155',
    active: '#475569',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#cbd5e1',
    muted: '#94a3b8',
    dim: '#64748b',
  },
  accent: {
    primary: '#38bdf8',
    hover: '#7dd3fc',
    glow: 'rgba(56, 189, 248, 0.15)',
    blue: '#3b82f6',
    blueLight: '#93c5fd',
    indigo: '#6366f1',
    rose: '#f43f5e',
    roseGlow: 'rgba(244, 63, 94, 0.15)',
    orange: '#fb923c',
  },
  status: {
    success: '#10b981',
    successLight: '#34d399',
    warning: '#f59e0b',
    danger: '#ef4444',
    dangerLight: '#fca5a5',
    dangerMuted: '#f87171',
    info: '#06b6d4',
  },
  attacks: {
    rf: {
      uav: '#f43f5e',
      ballistic: '#f59e0b',
      cruise: '#ef4444',
    },
    ua: {
      uav: '#0ea5e9',
      ballistic: '#818cf8',
      cruise: '#22d3ee',
    },
    uav: '#f43f5e',
    ballistic: '#f59e0b',
    cruise: '#ef4444',
  },
  losses: {
    rf: '#ef4444',
    ua: '#3b82f6',
    rfLight: '#fca5a5',
    uaLight: '#93c5fd',
  },
  budget: {
    defense: '#b91c1c',
    otherExp: '#475569',
    domesticRev: '#16a34a',
    grants: '#d97706',
    loans: '#facc15',
    debt: '#64748b',
    gdp: '#2563eb',
  },
  trade: {
    export: '#3b82f6',
    import: '#f97316',
    balance: '#38bdf8',
    exportTotal: '#3b82f6',
    importTotal: '#f97316',
    balanceLine: '#38bdf8',
  },
  country: {
    USA: '#2563eb',
    China: '#dc2626',
    Europe: '#d97706',
    Russia: '#9333ea',
    Japan: '#0d9488',
    India: '#16a34a',
    'South Korea': '#0891b2',
    Taiwan: '#c026d3',
    Others: '#94a3b8',
  },
} as const;

/** Category badge styling classes mapped by project tag identifier. */
export const tagStyles: Record<string, string> = {
  ua: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
  rf: 'bg-red-500/10 text-red-400 border-red-500/25',
  global: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  world: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  'air-defense': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  launches: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
  economy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  economic: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  budget: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  gdp: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  energy: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  industry: 'bg-teal-500/10 text-teal-400 border-teal-500/25',
  war: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  uav: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  missiles: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  losses: 'bg-red-500/10 text-red-400 border-red-500/25',
  equipment: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  space: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
  default: 'bg-surface-elevated text-content-secondary border-border-muted',
};

/** Global color mapping for major sovereign powers and regional economies. */
export const COUNTRY_COLORS: Record<string, string> = themeColors.country;

/** Fallback color hex code for unclassified or aggregate entities. */
export const DEFAULT_COUNTRY_COLOR: string = themeColors.country.Others;

/** Resolves a sovereign power or regional entity name to its standardized brand hex color code. */
export function getCountryColor(country: string): string {
  return COUNTRY_COLORS[country] || DEFAULT_COUNTRY_COLOR;
}

/** Resolves a category or topic tag to semantic Tailwind badge styling classes. */
export function getTagClasses(tag: string): string {
  const key = String(tag || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-');
  return tagStyles[key] || tagStyles.default;
}

/** Preset styling options defining standard dark-theme canvas visual properties for Apache ECharts. */
export interface ChartBaseTheme {
  backgroundColor: string;
  title: TitleComponentOption;
  legend: LegendComponentOption;
  grid: GridComponentOption;
  xAxis: XAXisComponentOption;
  yAxis: YAXisComponentOption;
  tooltip: TooltipComponentOption;
  dataZoom: DataZoomComponentOption;
}

/** Standard dark-theme canvas styling preset applied to all Apache ECharts instances. */
export const CHART_BASE_THEME: ChartBaseTheme = {
  backgroundColor: 'transparent',
  title: {
    textStyle: {
      color: themeColors.text.primary,
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    },
    subtextStyle: {
      color: themeColors.text.muted,
      fontSize: 12,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
