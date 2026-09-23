import { themeColors } from '../tokens.js';

/**
 * Styles and color palettes for War RF-UA Attacks charts:
 * 1. Monthly Dynamics of Strike UAVs (Shahed-136/131 & decoys)
 * 2. Missile Strikes & Air Defense Interceptions
 */

export const WAR_ATTACKS_THEME = {
  uav: {
    line: themeColors.accent.rose,
    area: themeColors.accent.roseGlow,
    launched: themeColors.accent.rose,
    downed: themeColors.accent.primary,
    rateLine: themeColors.status.success,
  },
  missiles: {
    ballistic: themeColors.status.warning,
    cruise: themeColors.accent.primary,
    downed: themeColors.accent.hover,
    rateLine: themeColors.status.info,
  },
  thresholds: {
    minMissileLabelCount: 5,  // Hide segment label if missile count <= 5
  },
};
