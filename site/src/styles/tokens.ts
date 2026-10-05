const SANS_STACK = ['Inter', 'system-ui', '-apple-system', 'sans-serif'] as const;

/** Single Source of Truth typography font stack for canvas charts. */
export const themeFonts = {
  sansFamily: SANS_STACK.join(', '),
};

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
    unk: '#7c3aed',
    rfLight: '#fca5a5',
    uaLight: '#93c5fd',
    unkLight: '#c4b5fd',
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
    categories: {
      agriculture: '#10b981',
      metals: '#64748b',
      machinery: '#3b82f6',
      minerals: '#f59e0b',
      chemicals: '#8b5cf6',
      timber: '#8d5b38',
      manufactured: '#f43f5e',
      other: '#0891b2',
    },
  },
};

/** Equipment loss side color mapping by numeric side index: 0 (RF), 1 (UA), 2 (Unknown / Mixed). */
export const lossSideColors: Record<number, string> = {
  0: themeColors.losses.rf,
  1: themeColors.losses.ua,
  2: themeColors.losses.unk,
};
