import { themeColors } from '../tokens.js';

/**
 * Styles and color palettes for War RF-UA Losses charts:
 * 1. Total Losses by Category Comparison (RF vs Ukraine)
 * 2. Monthly Dynamics of Verified Heavy Equipment Losses
 * 3. Top System Models Lost
 */

export const WAR_LOSSES_THEME = {
  sides: {
    rf: themeColors.status.danger,        // Russian Federation losses
    ua: themeColors.accent.blue,          // Ukraine losses
    unknown: themeColors.text.dim,        // Unclassified side
  },
  ratioLine: themeColors.status.warning,  // RF / UA loss ratio
};
