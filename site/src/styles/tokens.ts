const SANS_STACK = ['Inter', 'system-ui', '-apple-system', 'sans-serif'] as const;

/** Single Source of Truth typography font stack for canvas charts. */
export const themeFonts = {
  sansFamily: SANS_STACK.join(', '),
};

/** User-selectable theme setting mode. */
export type ThemeSetting = 'system' | 'dark' | 'light';

/** Concrete computed theme applied to the document and canvas renderers. */
export type ResolvedTheme = 'dark' | 'light';

/** Universal contract for theme-aware surface, border, text, and accent colors. */
export interface ThemeColors {
  /** Surface and background tokens */
  surface: {
    base: string;
    card: string;
    elevated: string;
    overlay: string;
  };
  /** Border and divider tokens */
  border: {
    subtle: string;
    muted: string;
    active: string;
  };
  /** Text typography tokens */
  text: {
    primary: string;
    secondary: string;
    muted: string;
    dim: string;
  };
  /** Core brand and highlight accent tokens */
  accent: {
    primary: string;
    hover: string;
    glow: string;
  };
  /** Semantic status feedback tokens */
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

/** Dark theme color palette optimized for high-contrast dark surfaces. */
const darkThemeColors: ThemeColors = {
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
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
  },
};

/** Light theme color palette tuned for clean readability on crisp white and light-gray surfaces. */
const lightThemeColors: ThemeColors = {
  surface: {
    base: '#f8fafc',
    card: '#ffffff',
    elevated: '#f1f5f9',
    overlay: 'rgba(255, 255, 255, 0.95)',
  },
  border: {
    subtle: '#e2e8f0',
    muted: '#cbd5e1',
    active: '#94a3b8',
  },
  text: {
    primary: '#0f172a',
    secondary: '#334155',
    muted: '#64748b',
    dim: '#94a3b8',
  },
  accent: {
    primary: '#0284c7',
    hover: '#0369a1',
    glow: 'rgba(2, 132, 199, 0.12)',
  },
  status: {
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#0284c7',
  },
};

/** Resolves the active ThemeColors palette object for a given concrete theme. */
export function getThemeColors(theme: ResolvedTheme): ThemeColors {
  return theme === 'dark' ? darkThemeColors : lightThemeColors;
}
