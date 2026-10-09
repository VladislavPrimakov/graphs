/** Equipment loss side and highlight colors (supporting side indices 0=RF, 1=UA, 2=Unknown and named keys). */
export const lossColors = {
  0: '#ef4444',
  1: '#3b82f6',
  2: '#7c3aed',
  rf: '#ef4444',
  ua: '#3b82f6',
  unk: '#7c3aed',
  rfLight: '#fca5a5',
  uaLight: '#93c5fd',
  unkLight: '#c4b5fd',
} as const;

/** Missile and UAV attack type colors by side. */
export const attackColors = {
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
} as const;

/** Territorial control and frontline layer colors. */
export const frontlineColors = {
  /** Consensus Russian control (Both sources agree) - Red. */
  consensusRf: '#ef4444',
  /** Contested zone (Discrepancies & contested areas) - Grey. */
  disputed: '#71717a',
  /** Discrepancy boundary stroke highlight. */
  disputedStroke: '#a1a1aa',
  /** Consensus sovereign Ukraine territory - Blue. */
  consensusUa: '#3b82f6',
  /** DeepState claimed frontline boundary line - Cyan/Sky. */
  deepstateLine: '#38bdf8',
  /** LostArmour claimed frontline boundary line - Rose/Red. */
  lostarmourLine: '#f43f5e',
  /** Net monthly territorial change trajectory line - Amber. */
  netChange: '#f59e0b',
} as const;
