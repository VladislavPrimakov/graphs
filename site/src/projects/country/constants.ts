/** Minimum top items selectable on trade ranking sliders. @default 1 */
export const MIN_TOP_COUNT = 1;

/** Maximum top items selectable on trade ranking sliders across all modes. @default 15 */
export const MAX_TOP_COUNT = 15;

/** Default top items selected on initial dashboard mount. @default 7 */
export const DEFAULT_TOP_COUNT = 7;

/** Default ISO alpha-2 country code on initial dashboard load. @default 'us' */
export const DEFAULT_COUNTRY_CODE = 'us';

/** Headroom multiplier for adaptive dynamic Y-axis maximum scaling. @default 1.15 */
export const PERCENT_HEADROOM_RATIO = 1.15;

/** Rounding step for adaptive percentage Y-axis tick intervals. @default 5 (%) */
export const PERCENT_ROUND_STEP = 5;

/** Minimum positive percentage axis upper bound. @default 10 (%) */
export const MIN_PERCENT_AXIS_BOUND = 10;

/** Maximum allowable percentage axis upper bound for shares. @default 100 (%) */
export const MAX_PERCENT_AXIS_BOUND = 100;

/** Ratio threshold for outlier capping in macroeconomic growth charts. @default 2.5 */
export const GROWTH_RATIO = 2.5;

/** Headroom multiplier for macroeconomic growth Y-axis maximum. @default 1.15 */
export const GROWTH_HEADROOM = 1.15;

/** Rounding step for macroeconomic growth Y-axis ticks. @default 20 (%) */
export const GROWTH_ROUND_STEP = 20;

/** Line stroke width for real GDP growth dashed series in px. @default 2 (px) */
export const REAL_GDP_LINE_WIDTH = 2;

/** Stroke width for zero markline separator in px. @default 1 (px) */
export const MARK_LINE_WIDTH = 1;

/** Line stroke width for net trade balance series in px. @default 3 (px) */
export const BALANCE_LINE_WIDTH = 3;

/** Symbol marker size for net trade balance line points in px. @default 12 (px) */
export const BALANCE_SYMBOL_SIZE = 12;
