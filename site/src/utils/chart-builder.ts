import type {
  BarSeriesOption,
  DefaultLabelFormatterCallbackParams as CallbackDataParams,
  ECharts,
  EChartsOption,
  GridComponentOption,
  LabelLayoutOptionCallback,
  LabelLayoutOptionCallbackParams,
  LegendComponentOption,
  LineSeriesOption,
  SeriesOption,
  SliderDataZoomComponentOption,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import { init } from 'echarts/core';
import { type ThemeColors, themeFonts } from '@/styles/tokens';
import { resolveColor, type SemanticColor } from '@/utils/color';
import {
  renderTooltipFooter,
  renderTooltipHeader,
  renderTooltipRow,
  renderTooltipTableStructure,
  type TooltipColumnSpec,
  type TooltipFooterSpec,
  type TooltipRowSpec,
  type TooltipTableRowSpec,
} from './tooltip-builder';

export type { TooltipColumnSpec, TooltipFooterSpec, TooltipRowSpec, TooltipTableRowSpec };

/* -------------------------------------------------------------------------- */
/* 1. Canvas Theme Invariants, Configuration & Styling Presets                */
/* -------------------------------------------------------------------------- */

/** Unified configuration parameters, geometry thresholds, and typography constants for charts. */
export const CHART_CONFIG = {
  animation: {
    /** Universal entrance animation duration in ms across all chart types. */
    duration: 400,
    /** Universal update animation duration in ms across all chart types during transitions/filter changes. */
    durationUpdate: 200,
    /** Universal easing for series transitions. */
    easingUpdate: 'cubicOut' as const,
  },
  layout: {
    /** Top clearance in pixels for the legend, grid, and toolbox. */
    topClearance: 4,
    /** Vertical spacing in pixels between legend and chart grid. */
    layoutGap: 12,
    /** Minimum delta threshold in pixels required to trigger a responsive grid offset update. */
    toleranceThreshold: 1,
  },
  typography: {
    line: {
      /** Minimum endLabel and point label font size in pixels on compact viewports. */
      minFontSize: 8.5,
      /** Maximum endLabel and point label font size in pixels on wide desktop displays. */
      maxFontSize: 11.5,
      /** Default fallback font size for line labels when canvas width is unavailable. */
      baseFontSize: 10.5,
      /** Mobile viewport reference width in pixels for continuous font interpolation. */
      mobileBreakpoint: 360,
      /** Desktop viewport reference width in pixels for continuous font interpolation. */
      desktopBreakpoint: 1440,
      /** Snap step increment in pixels for fluid line font size quantization. */
      quantizeStep: 0.5,
    },
    bar: {
      /** Minimum inside/outside bar label font size in pixels under tight column constraints. */
      minFontSize: 8.0,
      /** Maximum inside/outside bar label font size in pixels for spacious columns. */
      maxFontSize: 11.0,
      /** Base reference font size used for text width measurement and scaling. */
      baseFontSize: 10.0,
      /** Horizontal bar margin deduction in pixels for text fit calculations. */
      paddingX: 2,
      /** Minimum effective bar width in pixels considered for text scaling. */
      minEffectiveWidth: 10,
      /** Divisor used to sample representative data points per series (e.g. 10 samples). */
      sampleDivisor: 10,
      /** Percentile rank used to select the representative label string (P80). */
      percentileRank: 0.8,
      /** Snap step increment in pixels for bar font size quantization. */
      quantizeStep: 0.5,
      /** Ratio of category column width occupied by bars in fallback geometry estimates. */
      categoryWidthRatio: 0.6,
      /** Fallback bar width in pixels when container or categories are uninitialized. */
      fallbackWidth: 30,
      /** Maximum child elements inspected in ZRender group traversal. */
      maxInspectChildren: 20,
    },
    axis: {
      /** Axis tick label and split title font size in pixels. */
      fontSize: 12,
      /** Y-axis title end gap in pixels. */
      nameGap: 12,
    },
    legend: {
      /** Legend item label font size in pixels. */
      fontSize: 12,
      /** Legend marker icon height in pixels. */
      itemHeight: 12,
      /** Legend marker icon width in pixels. */
      itemWidth: 20,
      /** Gap between adjacent legend items in pixels. */
      itemGap: 4,
    },
    point: {
      /** Default distance in pixels between data point and its label. */
      distance: 6,
    },
    endLabel: {
      /** Default distance in pixels between line terminus and end label. */
      distance: 4,
    },
  },
  geometry: {
    /** Default corner radius in pixels applied to outermost bar extremities. */
    barBorderRadius: 4,
    /** Default symbol diameter in pixels for line series markers. */
    symbolSize: 6,
    /** Default line stroke width in pixels for line series. */
    lineWidth: 2.5,
    /** Text border outline width in pixels for high-contrast label readability. */
    textBorderWidth: 2,
  },
  tooltip: {
    /** Horizontal cursor offset in pixels for tooltip positioning. */
    offsetX: 16,
    /** Vertical cursor offset in pixels for tooltip positioning. */
    offsetY: 20,
    /** Minimum safety padding from canvas edges in pixels. */
    edgePadding: 8,
  },
  toolbox: {
    /** Right margin in pixels for the chart toolbox. */
    right: 12,
    /** Action button icon size in pixels. */
    itemSize: 12,
    /** Gap between adjacent toolbox action buttons in pixels. */
    itemGap: 8,
    /** Internal toolbox padding in pixels. */
    padding: 0,
  },
  dataZoom: {
    /** Bottom margin in pixels for slider data zoom component. */
    bottom: 4,
    /** Height in pixels of slider data zoom bar. */
    height: 22,
    /** Bottom margin clearance allocated to grid when dataZoom is active. */
    gridClearance: 40,
  },
  outlier: {
    /** Default multiplier ratio between adjacent ranked values to qualify as an isolated outlier. */
    defaultRatio: 2.5,
    /** Default additional headroom multiplier added to the effective maximum for chart spacing. */
    defaultHeadroom: 1.15,
    /** Default granularity rounding step for the resulting maximum. */
    defaultRoundStep: 20,
    /** Default minimum absolute threshold below which the calculated ceiling will not drop. */
    defaultFallbackMin: 0,
  },
  export: {
    /** Standard presentation width in pixels for exported PNG canvases. */
    canvasWidth: 1200,
    /** Standard presentation height in pixels for exported PNG canvases. */
    canvasHeight: 560,
    /** Device pixel ratio multiplier for high-DPI Retina exports. */
    pixelRatio: 2,
    /** Header height in pixels reserved for chart title banner in export canvas. */
    headerHeight: 40,
    /** Bottom margin in pixels cropped from exported canvas when dataZoom is active. */
    bottomCrop: 40,
    /** Title font size in pixels for exported image banner. */
    titleFontSize: 16,
  },
  cache: {
    /** Maximum entries retained in offscreen 2D canvas text width measurement cache before clearing. */
    textWidthCacheLimit: 500,
    /** Fallback average character width in pixels when DOM canvas context is unavailable. */
    fallbackCharWidth: 8,
  },
} as const;

/** Theme invariant components providing baseline typography, borders, and layout. */
interface CanvasInvariants {
  fontFamily: string;
  layout: typeof CHART_CONFIG.layout;
  legend: LegendComponentOption;
  grid: GridComponentOption;
  xAxis: XAXisComponentOption;
  yAxis: YAXisComponentOption;
  toolbox: {
    right: number;
    itemSize: number;
    itemGap: number;
    padding: number;
  };
  tooltip: TooltipComponentOption;
}

/** Dynamic tooltip position callback preventing canvas overflow horizontally and vertically. */
function resolveTooltipPosition(point: [number, number], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: [number, number]; viewSize: [number, number] }): [number, number] {
  const [x, y] = point;
  const [contentW, contentH] = size.contentSize;
  const [viewW, viewH] = size.viewSize;
  const { offsetX, offsetY, edgePadding } = CHART_CONFIG.tooltip;

  // 1. Horizontal: place to right of cursor, flip left if overflowing canvas width
  let posX = x + offsetX;
  if (posX + contentW > viewW) {
    posX = x - offsetX - contentW;
  }
  if (posX < edgePadding) {
    posX = edgePadding;
  }

  // 2. Vertical: smooth proportional anchoring preventing clipping in either direction
  let posY: number;
  if (contentH <= viewH) {
    posY = y - offsetY;
    if (posY + contentH > viewH - edgePadding) posY = viewH - contentH - edgePadding;
    if (posY < edgePadding) posY = edgePadding;
  } else {
    // Tooltip taller than canvas: interpolate position so active cursor area is always in view
    posY = Math.round(edgePadding + (viewH - contentH - edgePadding * 2) * Math.max(0, Math.min(1, y / viewH)));
  }

  return [posX, posY];
}

/** Computes fluid font size for line labels, axes, legend, and toolbox based on container/canvas width. */
export function computeFluidLineFontSize(canvasWidth?: number): number {
  const { minFontSize, maxFontSize, mobileBreakpoint, desktopBreakpoint, baseFontSize, quantizeStep } = CHART_CONFIG.typography.line;
  if (!canvasWidth || canvasWidth <= 0) return baseFontSize;
  const ratio = Math.max(0, Math.min(1, (canvasWidth - mobileBreakpoint) / (desktopBreakpoint - mobileBreakpoint)));
  const raw = minFontSize + ratio * (maxFontSize - minFontSize);
  return Math.max(minFontSize, Math.min(maxFontSize, Math.round(raw / quantizeStep) * quantizeStep));
}

/** Resolves theme invariants providing typography, borders, and grid boundaries for a concrete theme palette. */
function getCanvasInvariants(tokens: ThemeColors, lineFontSize: number = CHART_CONFIG.typography.line.baseFontSize, hasDataZoom = false): CanvasInvariants {
  const itemHeight = lineFontSize;
  const itemWidth = Math.round(lineFontSize * (CHART_CONFIG.typography.legend.itemWidth / CHART_CONFIG.typography.legend.itemHeight));
  const toolboxButtons = hasDataZoom ? 2 : 1;
  const toolboxWidth = CHART_CONFIG.toolbox.right + toolboxButtons * lineFontSize + (toolboxButtons - 1) * CHART_CONFIG.toolbox.itemGap;
  const toolboxPaddingRight = toolboxWidth + CHART_CONFIG.typography.axis.nameGap;
  const baseGridTop = CHART_CONFIG.layout.topClearance + lineFontSize + CHART_CONFIG.typography.axis.nameGap;

  return {
    fontFamily: themeFonts.sansFamily,
    layout: CHART_CONFIG.layout,
    legend: {
      top: CHART_CONFIG.layout.topClearance,
      left: 'center',
      padding: [0, toolboxPaddingRight, 0, 0],
      itemHeight,
      itemWidth,
      itemGap: CHART_CONFIG.typography.legend.itemGap,
      textStyle: {
        color: tokens.text.secondary,
        fontSize: lineFontSize,
        lineHeight: lineFontSize,
        fontFamily: themeFonts.sansFamily,
      },
    },
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: baseGridTop,
    },
    xAxis: {
      axisLabel: {
        color: tokens.text.secondary,
        fontSize: lineFontSize,
      },
      axisLine: {
        lineStyle: { color: tokens.border.muted },
      },
    },
    yAxis: {
      nameLocation: 'end',
      nameGap: CHART_CONFIG.typography.axis.nameGap,
      nameTextStyle: {
        color: tokens.text.muted,
        fontSize: lineFontSize,
        lineHeight: lineFontSize,
        align: 'right',
      },
      splitLine: {
        lineStyle: {
          color: tokens.border.subtle,
          type: 'dashed',
        },
      },
      axisLabel: {
        color: tokens.text.muted,
      },
    },
    toolbox: {
      right: CHART_CONFIG.toolbox.right,
      itemSize: lineFontSize,
      itemGap: CHART_CONFIG.toolbox.itemGap,
      padding: CHART_CONFIG.toolbox.padding,
    },
    tooltip: {
      confine: false,
      position: resolveTooltipPosition,
      extraCssText: `background: ${tokens.surface.overlay}; border: 1px solid ${tokens.border.muted}; border-radius: 8px; padding: 10px 14px; color: ${tokens.text.primary}; font-family: ${themeFonts.sansFamily}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35); backdrop-filter: blur(8px); pointer-events: none`,
    },
  };
}

/** Opt-in feature templates applied only when explicitly declared in the user option. */
interface OptInTemplates {
  dataZoom: SliderDataZoomComponentOption;
}

/** Resolves opt-in feature templates applied only when explicitly declared in the user option. */
function getOptInTemplates(tokens: ThemeColors, lineFontSize: number = CHART_CONFIG.typography.line.baseFontSize): OptInTemplates {
  return {
    dataZoom: {
      bottom: CHART_CONFIG.dataZoom.bottom,
      height: CHART_CONFIG.dataZoom.height,
      borderColor: tokens.border.muted,
      fillerColor: tokens.accent.glow,
      handleStyle: { color: tokens.accent.primary },
      textStyle: { color: tokens.text.muted, fontSize: lineFontSize },
    },
  };
}

/** Default series label typography and outline styling contract. */
export interface SeriesLabelStyle {
  fontFamily: string;
  fontWeight: string;
  color: string;
  textBorderColor: string;
  textBorderWidth: number;
}

/** Resolves default contrast outline stroke and bold typography applied to data labels across charts. */
function getDefaultLabelStyle(tokens: ThemeColors): SeriesLabelStyle {
  return {
    fontFamily: themeFonts.sansFamily,
    fontWeight: 'bold',
    color: tokens.text.primary,
    textBorderColor: tokens.surface.card,
    textBorderWidth: CHART_CONFIG.geometry.textBorderWidth,
  };
}

/** Default styling for line series end labels (e.g. world economic indicators). */
const DEFAULT_END_LABEL_STYLE = {
  show: true,
  fontFamily: themeFonts.sansFamily,
  fontWeight: 'bold',
  color: 'inherit',
  fontSize: CHART_CONFIG.typography.line.baseFontSize,
  distance: CHART_CONFIG.typography.endLabel.distance,
  valueAnimation: false,
};

/** Base default geometric presets for line series. */
const THEME_LINE: Partial<LineSeriesOption> = {
  smooth: true,
  symbol: 'circle',
  symbolSize: CHART_CONFIG.geometry.symbolSize,
  lineStyle: { width: CHART_CONFIG.geometry.lineWidth },
};

/* -------------------------------------------------------------------------- */
/* 2. Numeric & Data Extraction Utilities                                     */
/* -------------------------------------------------------------------------- */

/** Extracts numeric Y-value from scalar, coordinate tuple [x, y], or ECharts data object / params. */
export function extractPointValue(item: unknown): number | undefined {
  if (typeof item === 'number') return item;
  if (!item) return undefined;

  if (Array.isArray(item)) {
    const val = item.length > 1 ? item[1] : item[0];
    return typeof val === 'number' ? val : undefined;
  }

  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const raw = obj.total !== undefined ? obj.total : obj.originalValue !== undefined ? obj.originalValue : obj.value !== undefined ? obj.value : obj;
    if (typeof raw === 'number') return raw;
    if (Array.isArray(raw)) {
      const v = raw.length > 1 ? raw[1] : raw[0];
      return typeof v === 'number' ? v : undefined;
    }
  }

  return undefined;
}

/** Scans series data for positive/negative values with early exit and zero array allocations. */
function getSeriesSign(data?: BarSeriesOption['data']): { hasPositive: boolean; hasNegative: boolean } {
  let hasPositive = false;
  let hasNegative = false;
  if (!data || data.length === 0) return { hasPositive, hasNegative };
  for (let i = 0; i < data.length; i++) {
    const val = extractPointValue(data[i]);
    if (val !== undefined) {
      if (val > 0) hasPositive = true;
      else if (val < 0) hasNegative = true;
      if (hasPositive && hasNegative) break;
    }
  }
  return { hasPositive, hasNegative };
}

const TOP_BAR_RADIUS: [number, number, number, number] = [CHART_CONFIG.geometry.barBorderRadius, CHART_CONFIG.geometry.barBorderRadius, 0, 0];
const BOT_BAR_RADIUS: [number, number, number, number] = [0, 0, CHART_CONFIG.geometry.barBorderRadius, CHART_CONFIG.geometry.barBorderRadius];

/**
 * Resolves contextual corner radius for bar series:
 * - Standalone bars receive rounded top corners [4, 4, 0, 0] (or bottom [0, 0, 4, 4] if negative).
 * - Stacked bars receive flat seams (0) between stacked layers, rounding only the outermost extremities.
 * - Explicit user-specified borderRadius is always preserved.
 */
function resolveBarBorderRadius(seriesList: SeriesOption[]): void {
  if (!seriesList.some((s) => s?.type === 'bar')) return;

  const stackGroups = new Map<string, BarSeriesOption[]>();

  for (const s of seriesList) {
    if (s?.type !== 'bar') continue;
    const bar = s as BarSeriesOption;
    const stackKey = bar.stack ? String(bar.stack) : '';
    let group = stackGroups.get(stackKey);
    if (!group) {
      group = [];
      stackGroups.set(stackKey, group);
    }
    group.push(bar);
  }

  for (const [stackKey, group] of stackGroups.entries()) {
    if (!stackKey) {
      // Standalone bars
      for (const s of group) {
        if (s.itemStyle?.borderRadius !== undefined) continue;
        const { hasPositive, hasNegative } = getSeriesSign(s.data);
        s.itemStyle = { ...s.itemStyle, borderRadius: hasNegative && !hasPositive ? BOT_BAR_RADIUS : TOP_BAR_RADIUS };
      }
    } else {
      // Stacked bar groups: pre-compute series signs once to eliminate duplicate data scans
      const pos: BarSeriesOption[] = [];
      const neg: BarSeriesOption[] = [];

      for (const s of group) {
        const sign = getSeriesSign(s.data);
        if (sign.hasPositive) pos.push(s);
        if (sign.hasNegative) neg.push(s);
      }

      const topPos = pos[pos.length - 1];
      const botNeg = neg[neg.length - 1];

      for (const s of group) {
        if (s.itemStyle?.borderRadius !== undefined) continue;
        const radius = s === topPos ? TOP_BAR_RADIUS : s === botNeg ? BOT_BAR_RADIUS : 0;
        s.itemStyle = { ...s.itemStyle, borderRadius: radius };
      }
    }
  }
}

/**
 * Recursively merges a base default theme specification with a user override.
 * Automatically broadcasts a single template object across array overrides (e.g. 1-to-N dual axes or dataZooms).
 */
function smartMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (override === null || typeof override !== 'object') return override;
  if (!base || typeof base !== 'object') return override;

  if (Array.isArray(override)) {
    if (!Array.isArray(base)) {
      return override.map((item) => smartMerge(base, item));
    }
    return override.map((item, idx) => smartMerge(base[idx], item));
  }

  const result: Record<string, unknown> = { ...base };
  for (const key in override) {
    if (Object.hasOwn(override, key)) {
      const overrideVal = override[key];
      if (overrideVal !== undefined) {
        result[key] = key in result ? smartMerge(result[key], overrideVal) : overrideVal;
      }
    }
  }
  return result;
}

/** Applies default geometric presets and text contrast styling to a single series and its itemized labels. */
function enhanceSingleSeries(series: SeriesOption, labelStyle: SeriesLabelStyle): SeriesOption {
  if (!series) return series;

  const enhanced: SeriesOption = series.type === 'line' ? smartMerge(THEME_LINE, series) : { ...series };

  if ('label' in enhanced && enhanced.label) {
    enhanced.label = smartMerge(labelStyle, enhanced.label);
  }

  if ('endLabel' in enhanced && enhanced.endLabel) {
    enhanced.endLabel = smartMerge(DEFAULT_END_LABEL_STYLE, enhanced.endLabel);
    if (!enhanced.labelLayout && (enhanced.endLabel as { show?: boolean }).show !== false) {
      enhanced.labelLayout = { moveOverlap: 'shiftY' };
    }
  }

  const labelObj = 'label' in enhanced && enhanced.label ? (enhanced.label as { show?: boolean; position?: string; distance?: number }) : undefined;
  const isInside = typeof labelObj?.position === 'string' && labelObj.position.startsWith('inside');
  const needsSignPositioning = Boolean(labelObj && labelObj.show !== false && !isInside);

  // 1. Single-pass data optimization: sign-aware anchoring + user item-label styling
  if (Array.isArray(enhanced.data) && enhanced.data.length > 0) {
    if (needsSignPositioning && labelObj && labelObj.distance === undefined) {
      labelObj.distance = CHART_CONFIG.typography.point.distance;
    }

    let modified = false;
    const transformed = enhanced.data.map((item) => {
      const itemObj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
      const rawLabel = itemObj && 'label' in itemObj && itemObj.label ? (itemObj.label as Record<string, unknown>) : undefined;

      // Only merge theme labelStyle if point had an explicit user-provided custom label
      const styledLabel = rawLabel ? smartMerge(labelStyle, rawLabel) : undefined;

      if (!needsSignPositioning) {
        if (styledLabel && styledLabel !== rawLabel && itemObj) {
          modified = true;
          return { ...itemObj, label: styledLabel };
        }
        return item;
      }

      const val = extractPointValue(item);
      if (val === undefined) {
        if (styledLabel && styledLabel !== rawLabel && itemObj) {
          modified = true;
          return { ...itemObj, label: styledLabel };
        }
        return item;
      }
      const targetPos = val < 0 ? 'bottom' : 'top';

      if (itemObj) {
        if (rawLabel?.position && String(rawLabel.position).startsWith('inside')) {
          if (styledLabel && styledLabel !== rawLabel) {
            modified = true;
            return { ...itemObj, label: styledLabel };
          }
          return item;
        }
        modified = true;
        return {
          ...itemObj,
          label: {
            ...(styledLabel ?? rawLabel),
            position: rawLabel?.position ?? targetPos,
          },
        };
      }

      modified = true;
      return {
        value: item,
        label: { position: targetPos },
      };
    });

    if (modified) {
      enhanced.data = transformed;
      if (needsSignPositioning && labelObj && (labelObj.position === 'top' || labelObj.position === 'bottom')) {
        delete labelObj.position;
      }
    }
  }

  // 2. Collision resolution & overflow protection
  const hasVisibleLabel = Boolean(labelObj && labelObj.show !== false);
  const userFn = typeof enhanced.labelLayout === 'function' ? (enhanced.labelLayout as LabelLayoutOptionCallback) : undefined;
  const userLayoutObj = typeof enhanced.labelLayout === 'object' && enhanced.labelLayout !== null ? (enhanced.labelLayout as ReturnType<LabelLayoutOptionCallback>) : undefined;

  if (hasVisibleLabel || userFn || userLayoutObj) {
    const isBar = enhanced.type === 'bar';
    const ext = enhanced as { hideIfOverflowBar?: boolean; hideOverlap?: boolean; stack?: string };
    const isStacked = Boolean(ext.stack);
    const isInsideLabel = isInside || !labelObj?.position || isStacked;
    const hideIfOverflow = isBar ? ext.hideIfOverflowBar === true : false;
    const hideOverlap = ext.hideOverlap !== undefined ? ext.hideOverlap : !isInsideLabel;

    // Fast path: use static object if no dynamic bar geometry check or user callback is needed
    if (!userFn && (!hideIfOverflow || !isInsideLabel)) {
      enhanced.labelLayout = {
        hideOverlap,
        ...userLayoutObj,
      };
    } else {
      enhanced.labelLayout = (params: LabelLayoutOptionCallbackParams) => {
        const userRes = userFn ? userFn(params) : userLayoutObj;
        let isOverflowing = false;

        if (hideIfOverflow && isInsideLabel && params.rect && params.labelRect) {
          const barWidth = Math.abs(params.rect.width);
          const barHeight = Math.abs(params.rect.height);
          const labelWidth = Math.abs(params.labelRect.width);
          const labelHeight = Math.abs(params.labelRect.height);

          if ((labelHeight > 0 && barHeight + 1 < labelHeight) || (labelWidth > 0 && barWidth + 1 < labelWidth)) {
            isOverflowing = true;
          }
        }

        return {
          hideOverlap,
          ...userRes,
          ...(isOverflowing ? { x: -9999, y: -9999 } : {}),
        };
      };
    }
  }

  return enhanced;
}

/** Processes all chart series through series-specific style enhancements and resolves stack geometry. */
function enhanceSeries(series: EChartsOption['series'], labelStyle: SeriesLabelStyle): EChartsOption['series'] {
  if (!series) return series;
  const list = Array.isArray(series) ? series.map((s) => enhanceSingleSeries(s, labelStyle)) : [enhanceSingleSeries(series, labelStyle)];
  resolveBarBorderRadius(list);
  return Array.isArray(series) ? list : list[0];
}

/** Inspects whether legend is enabled in user options. */
function isLegendEnabled(option: EChartsOption): boolean {
  const optLegend = Array.isArray(option.legend) ? option.legend[0] : option.legend;
  return optLegend?.show !== false;
}

/** Localized action button labels for ECharts toolbox. */
export interface ToolboxLabels {
  /** Label for data zoom / view reset button. @default 'Restore' */
  restore?: string;
  /** Label for exporting canvas to PNG image. @default 'Export PNG' */
  exportPng?: string;
}

const DEFAULT_MEASURE_FONT = `bold ${CHART_CONFIG.typography.line.baseFontSize}px ${themeFonts.sansFamily}`;
let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
let activeFont: string | null = null;
const textWidthCache = new Map<string, number>();

/** Measures pixel width of a rendered text string using a shared offscreen canvas context with bounded FIFO/LRU cache. */
function measureTextWidth(text: string, font: string = DEFAULT_MEASURE_FONT): number {
  if (!text) return 0;
  if (text.includes('\n')) {
    const lines = text.split('\n');
    let max = 0;
    for (let i = 0; i < lines.length; i++) {
      const w = measureTextWidth(lines[i], font);
      if (w > max) max = w;
    }
    return max;
  }

  // Fast path: use text directly as cache key for the dominant default font to avoid string concatenation
  const cacheKey = font === DEFAULT_MEASURE_FONT ? text : `${font}:${text}`;
  const cached = textWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let width = text.length * CHART_CONFIG.cache.fallbackCharWidth;
  if (typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined') {
    if (!measureCtx) {
      measureCtx =
        typeof OffscreenCanvas !== 'undefined'
          ? (new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D | null)
          : (document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D | null);
    }
    if (measureCtx) {
      if (activeFont !== font) {
        measureCtx.font = font;
        activeFont = font;
      }
      width = measureCtx.measureText(text).width;
    }
  }

  // True O(1) FIFO eviction: drop oldest entry instead of wiping the entire cache
  if (textWidthCache.size >= CHART_CONFIG.cache.textWidthCacheLimit) {
    const oldestKey = textWidthCache.keys().next().value;
    if (oldestKey !== undefined) textWidthCache.delete(oldestKey);
  }
  textWidthCache.set(cacheKey, width);
  return width;
}

/** Resolves the last valid data point index and formatted endLabel text of a line series. */
function resolveLastEndLabel(item: any): { text: string; lastIndex: number } | null {
  if (!item?.endLabel || item.endLabel.show === false) return null;
  const data = Array.isArray(item.data) ? item.data : [];
  let lastVal: unknown;
  let lastIndex = -1;

  for (let i = data.length - 1; i >= 0; i--) {
    const val = extractPointValue(data[i]);
    if (val !== undefined && !Number.isNaN(val)) {
      lastVal = val;
      lastIndex = i;
      break;
    }
  }
  if (lastVal === undefined || lastIndex === -1) return null;

  const seriesName = typeof item.name === 'string' ? item.name : '';
  let text = '';
  if (typeof item.endLabel.formatter === 'function') {
    text = String(item.endLabel.formatter({ value: lastVal, seriesName, dataIndex: lastIndex }) ?? '');
  } else if (typeof item.endLabel.formatter === 'string') {
    text = item.endLabel.formatter.replace('{a}', seriesName).replace('{c}', String(lastVal));
  } else {
    text = seriesName ? `${seriesName}: ${lastVal}` : String(lastVal);
  }

  return text ? { text, lastIndex } : null;
}

/** Computes static right clearance in pixels required to render line series end labels without canvas clipping. */
function computeEndLabelClearance(series: EChartsOption['series']): number {
  if (!series) return 0;
  const list = Array.isArray(series) ? series : [series];
  let maxWidth = 0;

  for (const s of list) {
    if (!s || typeof s !== 'object' || (s as { type?: string }).type !== 'line') continue;
    const resolved = resolveLastEndLabel(s);
    if (resolved) {
      const w = measureTextWidth(resolved.text);
      if (w > maxWidth) maxWidth = w;
    }
  }

  return maxWidth > 0 ? Math.ceil(maxWidth) : 0;
}

/**
 * Computes dynamic right clearance in pixels required to render line series end labels without canvas clipping.
 * Dynamically factors in the horizontal distance between the series last valid data point and the end of the X-axis.
 */
function computeDynamicEndLabelClearance(seriesModels: any[], xAxisOption: any, gridWidth: number, lineFontSize: number = CHART_CONFIG.typography.line.baseFontSize): number {
  if (!seriesModels?.length) return 0;

  const xAxisData = xAxisOption && 'data' in xAxisOption && Array.isArray(xAxisOption.data) ? xAxisOption.data : undefined;
  let totalPoints = xAxisData?.length ?? 0;
  if (!totalPoints) {
    for (const s of seriesModels) {
      if (s?.subType === 'line' && s?.option?.endLabel && s.option.endLabel.show !== false) {
        const len = Array.isArray(s.option?.data) ? s.option.data.length : 0;
        if (len > totalPoints) totalPoints = len;
      }
    }
  }
  if (!totalPoints) return 0;

  const isBoundaryGap = Boolean(xAxisOption?.boundaryGap === true);
  const tickStep = gridWidth > 0 && totalPoints > (isBoundaryGap ? 0 : 1) ? gridWidth / (isBoundaryGap ? totalPoints : totalPoints - 1) : 0;

  let maxOverhang = 0;
  const isBaseFont = lineFontSize === CHART_CONFIG.typography.line.baseFontSize;
  const fontSpec = isBaseFont ? DEFAULT_MEASURE_FONT : `bold ${lineFontSize}px ${themeFonts.sansFamily}`;

  for (const s of seriesModels) {
    if (s?.subType !== 'line' || !s?.option?.endLabel || s.option.endLabel.show === false) continue;

    const item = s.option;
    const resolved = resolveLastEndLabel(item);
    if (!resolved) continue;

    const distance = typeof item.endLabel.distance === 'number' ? item.endLabel.distance : CHART_CONFIG.typography.endLabel.distance;
    const totalLabelSpan = measureTextWidth(resolved.text, fontSpec) + distance;
    const distToRight = tickStep > 0 ? (totalPoints - 1 - resolved.lastIndex + (isBoundaryGap ? 0.5 : 0)) * tickStep : 0;

    const overhang = totalLabelSpan - distToRight;
    if (overhang > maxOverhang) {
      maxOverhang = overhang;
    }
  }

  return maxOverhang > 0 ? Math.ceil(maxOverhang) : 0;
}

const BAR_BASE_FONT = `bold ${CHART_CONFIG.typography.bar.baseFontSize}px ${themeFonts.sansFamily}`;

/**
 * Calculates a uniform base font size for bar series labels by comparing measured text width with physical bar geometry.
 * Clamps dynamically between minFontSize (8px) and maxFontSize (11px).
 */
function computeUniformBarFontSize(chart: ECharts, barSeriesModels: any[], gridWidth: number, totalCategories: number): number {
  const { minFontSize, maxFontSize, baseFontSize, paddingX, minEffectiveWidth, sampleDivisor, percentileRank, quantizeStep, categoryWidthRatio, fallbackWidth, maxInspectChildren } =
    CHART_CONFIG.typography.bar;

  if (!barSeriesModels?.length) return baseFontSize;

  let physicalBarWidth: number | undefined;
  for (const s of barSeriesModels) {
    const view = chart['getViewOfSeriesModel']?.(s);
    if (view?.group) {
      const childCount = Math.min(view.group.childCount(), maxInspectChildren);
      for (let i = 0; i < childCount; i++) {
        const child = view.group.childAt(i);
        const w = child?.shape?.width;
        if (typeof w === 'number' && w !== 0) {
          physicalBarWidth = Math.abs(w);
          break;
        }
      }
    }
    if (physicalBarWidth !== undefined) break;
  }

  const effectiveBarWidth = physicalBarWidth ?? (gridWidth > 0 && totalCategories > 0 ? (gridWidth / totalCategories) * categoryWidthRatio : fallbackWidth);

  const sampleStrings: string[] = [];
  for (const s of barSeriesModels) {
    const opt = s.option;
    if (!opt || opt.label?.show === false) continue;
    const data = Array.isArray(opt.data) ? opt.data : [];
    const step = Math.max(1, Math.floor(data.length / sampleDivisor));

    for (let i = 0; i < data.length; i += step) {
      const item = data[i];
      if (item == null) continue;
      const val = extractPointValue(item);
      if (val === undefined || val === 0) continue;

      let str = '';
      if (typeof opt.formatLabel === 'function') {
        str = opt.formatLabel({ value: val, index: i, item }) ?? '';
      } else if (typeof opt.formatTotal === 'function') {
        str = opt.formatTotal({ total: val, index: i, item }) ?? '';
      } else if (typeof opt.label?.formatter === 'function') {
        str = opt.label.formatter({ value: val, dataIndex: i, data: item }) ?? '';
      } else if (typeof opt.label?.formatter === 'string') {
        str = opt.label.formatter.replace('{c}', String(val));
      } else {
        str = String(val);
      }
      if (str) sampleStrings.push(str);
    }
  }

  if (sampleStrings.length === 0) return baseFontSize;

  sampleStrings.sort((a, b) => a.length - b.length);
  const pRankIndex = Math.min(sampleStrings.length - 1, Math.floor(sampleStrings.length * percentileRank));
  const representativeText = sampleStrings[pRankIndex];

  const textWidth = measureTextWidth(representativeText, BAR_BASE_FONT);
  if (textWidth <= 0) return baseFontSize;

  const availableWidth = Math.max(minEffectiveWidth, effectiveBarWidth - paddingX);
  const scale = availableWidth / textWidth;
  const rawSize = baseFontSize * scale;

  const quantized = Math.round(rawSize / quantizeStep) * quantizeStep;
  return Math.max(minFontSize, Math.min(maxFontSize, quantized));
}

/** Recursively enhances an axis definition (or array of axes) with canvas theme invariants. */
function enhanceAxis<T extends XAXisComponentOption | YAXisComponentOption>(axis: T | T[] | undefined, invariants: T): T | T[] | undefined {
  if (!axis) return invariants;
  const enhanceSingle = (ax: T): T => smartMerge(invariants, ax);
  return Array.isArray(axis) ? (axis.map(enhanceSingle) as T[]) : enhanceSingle(axis);
}

/** Exports an ECharts canvas instance to a high-resolution PNG image at standard presentation dimensions (2400x1120 Retina). */
export function exportChartAsPng(chart: ECharts, title: string | undefined, exportName: string, tokens: ThemeColors): void {
  if (!chart || chart.isDisposed()) return;

  const model = chart['getModel']?.();
  const dataZoomModel = model?.getComponent('dataZoom');
  const hasDataZoom = Boolean(dataZoomModel && dataZoomModel.get('show') !== false);

  const { canvasWidth, canvasHeight, pixelRatio, headerHeight: baseHeaderHeight, bottomCrop: baseBottomCrop, titleFontSize } = CHART_CONFIG.export;

  // 1. Create hidden offscreen container with fixed standard presentation dimensions
  const offscreenDiv = document.createElement('div');
  offscreenDiv.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${canvasWidth}px;height:${canvasHeight}px;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(offscreenDiv);

  let sourceCanvas: HTMLCanvasElement | null = null;
  try {
    const offscreenChart = init(offscreenDiv, undefined, {
      renderer: 'canvas',
      devicePixelRatio: pixelRatio,
      width: canvasWidth,
      height: canvasHeight,
    });

    const currentOption = chart.getOption() as EChartsOption;
    offscreenChart.setOption(
      {
        ...currentOption,
        animation: false,
      },
      true,
    );
    adjustChartLayout(offscreenChart);

    // Suppress toolbox from rendered canvas without altering layout geometry
    const offscreenModel = offscreenChart['getModel']?.();
    const toolboxModel = offscreenModel?.getComponent('toolbox');
    const toolboxView = toolboxModel ? offscreenChart['getViewOfComponentModel']?.(toolboxModel) : null;
    const prevIgnore = toolboxView?.group?.ignore;
    if (toolboxView?.group) {
      toolboxView.group.ignore = true;
    }

    // Direct canvas-to-canvas extraction bypassing slow base64 encoding/decoding round-trips
    sourceCanvas =
      offscreenChart['renderToCanvas']?.({
        pixelRatio,
        backgroundColor: tokens.surface.card,
      }) ?? offscreenDiv.querySelector('canvas');

    if (toolboxView?.group && prevIgnore !== undefined) {
      toolboxView.group.ignore = prevIgnore;
    }

    offscreenChart.dispose();
  } catch {
    // Fallback to live canvas
    sourceCanvas =
      chart['renderToCanvas']?.({
        pixelRatio,
        backgroundColor: tokens.surface.card,
      }) ?? (chart.getDom()?.querySelector('canvas') as HTMLCanvasElement | null);
  } finally {
    offscreenDiv.remove();
  }

  if (!sourceCanvas) return;

  const headerHeight = title ? baseHeaderHeight * pixelRatio : 0;
  const bottomCrop = hasDataZoom ? baseBottomCrop * pixelRatio : 0;
  const sourceHeight = Math.max(1, sourceCanvas.height - bottomCrop);
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = headerHeight + sourceHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Fill composite background with theme card surface color
  ctx.fillStyle = tokens.surface.card;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw centered title if present
  if (title) {
    ctx.fillStyle = tokens.text.primary;
    ctx.font = `bold ${titleFontSize * pixelRatio}px ${themeFonts.sansFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvas.width / 2, headerHeight / 2);
  }

  // 3. Draw chart canvas cropped to remove bottom dataZoom clearance directly
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceHeight, 0, headerHeight, sourceCanvas.width, sourceHeight);

  // 4. Trigger download via lightweight Blob URL instead of multi-megabyte data URI
  const fileName = `${exportName || 'chart'}.png`;
  if (typeof canvas.toBlob === 'function') {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } else {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

const EXPORT_ICON_PATH = 'path://M4.7,22.9L29.3,45.5L54.7,23.4M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0';

/** Merges user-specified native ECharts option with theme defaults, fonts, and localized export controls. */
export function enhanceOption(option: EChartsOption, labels: ToolboxLabels, _exportName: string, tokens: ThemeColors, onExport?: () => void, canvasWidth?: number): EChartsOption {
  // Fast zero-allocation dataZoom inspection
  const dz = option.dataZoom;
  const hasDataZoom = Array.isArray(dz)
    ? dz.some((item) => item && typeof item === 'object' && ('show' in item ? item.show !== false : 'disabled' in item ? !item.disabled : true))
    : Boolean(dz && typeof dz === 'object' && ('show' in dz ? dz.show !== false : 'disabled' in dz ? !dz.disabled : true));

  const lineFontSize = computeFluidLineFontSize(canvasWidth);
  const invariants = getCanvasInvariants(tokens, lineFontSize, hasDataZoom);
  const optInTemplates = getOptInTemplates(tokens, lineFontSize);
  const defaultLabelStyle = getDefaultLabelStyle(tokens);
  const showLegend = isLegendEnabled(option);

  const optTooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
  const endLabelClearance = computeEndLabelClearance(option.series);
  const bottomClearance = hasDataZoom ? CHART_CONFIG.dataZoom.gridClearance : 0;

  const toolboxDefaults = {
    right: invariants.toolbox.right,
    top: CHART_CONFIG.layout.topClearance,
    itemSize: invariants.toolbox.itemSize,
    itemGap: invariants.toolbox.itemGap,
    padding: invariants.toolbox.padding,
    iconStyle: { borderColor: tokens.text.muted },
    emphasis: { iconStyle: { borderColor: tokens.accent.primary } },
    feature: {
      ...(hasDataZoom ? { restore: { title: labels.restore ?? 'Restore' } } : {}),
      myExport: {
        show: true,
        title: labels.exportPng ?? 'Export PNG',
        icon: EXPORT_ICON_PATH,
        onclick: onExport,
      },
    },
  };

  const baseGrid = {
    ...invariants.grid,
    right: endLabelClearance,
    bottom: bottomClearance,
  };

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: invariants.fontFamily, ...option.textStyle },
    title: { show: false },
    legend: showLegend ? (option.legend ? smartMerge(invariants.legend, option.legend) : invariants.legend) : { show: false },
    grid: option.grid ? smartMerge(baseGrid, option.grid) : baseGrid,
    xAxis: enhanceAxis(option.xAxis, invariants.xAxis),
    yAxis: enhanceAxis(option.yAxis, invariants.yAxis),
    series: enhanceSeries(option.series, defaultLabelStyle),
    dataZoom: option.dataZoom ? smartMerge(optInTemplates.dataZoom, option.dataZoom) : undefined,
    tooltip: optTooltip?.show === false ? { show: false } : option.tooltip ? smartMerge(invariants.tooltip, option.tooltip) : invariants.tooltip,
    toolbox: option.toolbox ? smartMerge(toolboxDefaults, option.toolbox) : toolboxDefaults,
    animation: option.animation ?? true,
    animationDuration: option.animationDuration ?? CHART_CONFIG.animation.duration,
    animationDurationUpdate: option.animationDurationUpdate ?? CHART_CONFIG.animation.durationUpdate,
    animationEasingUpdate: option.animationEasingUpdate ?? CHART_CONFIG.animation.easingUpdate,
  };
}

/** Dynamically adjusts ECharts grid offsets and typography (fluid lines/endLabels, uniform bar sizes) based on actual canvas dimensions. */
export function adjustChartLayout(chart: ECharts, hasEndLabel?: boolean): void {
  try {
    if (!chart || chart.isDisposed()) return;

    // 1. Inspect internal ECharts global model & components
    const model = chart['getModel']?.();
    if (!model) return;

    const gridModel = model.getComponent('grid');
    const currentGrid = gridModel?.option;
    if (!currentGrid) return;

    const gridCoord = gridModel?.coordinateSystem;
    const gridRect = gridCoord?.getRect?.();
    const gridWidth = gridRect?.width ?? 0;
    const yAxisLeft = gridRect?.x ?? 0;

    const legendModel = model.getComponent('legend');
    const isLegendActive = Boolean(legendModel && legendModel.get('show') !== false);

    const toolboxModel = model.getComponent('toolbox');
    const isToolboxActive = Boolean(toolboxModel && toolboxModel.get('show') !== false);

    const dataZoomModel = model.getComponent('dataZoom');
    const hasDataZoom = Boolean(dataZoomModel && dataZoomModel.get('show') !== false);

    const yAxisModel = model.getComponent('yAxis');
    const componentGap = Number(yAxisModel?.get('nameGap') ?? CHART_CONFIG.typography.axis.nameGap);

    // 2. Stream 1: Dynamic typography & sizing engine (fluid lineFontSize, matching legend markers & toolbox icons)
    const canvasWidth = chart.getWidth?.() ?? 0;
    const lineFontSize = computeFluidLineFontSize(canvasWidth);
    const itemHeight = lineFontSize;
    const itemWidth = Math.round(lineFontSize * (CHART_CONFIG.typography.legend.itemWidth / CHART_CONFIG.typography.legend.itemHeight));
    const toolboxItemSize = lineFontSize;

    // 3. Baseline vertical alignment established in enhanceOption (all elements share baseTop)
    const baseTop = Number(legendModel?.get('top') ?? currentGrid.top ?? CHART_CONFIG.layout.topClearance);
    let legendHeight = itemHeight;

    // 4. Resolve horizontal boundaries and multi-line wrapping clearance for legend
    if (isLegendActive && legendModel) {
      const legendGroup = chart['getViewOfComponentModel']?.(legendModel)?.group;
      if (legendGroup) {
        const minLegendLeft = yAxisLeft > 0 ? yAxisLeft + componentGap : 0;

        let toolboxPaddingRight = 0;
        if (isToolboxActive && toolboxModel) {
          const toolboxItemGap = Number(toolboxModel.get('itemGap') ?? CHART_CONFIG.toolbox.itemGap);
          const toolboxRight = Number(toolboxModel.get('right') ?? CHART_CONFIG.toolbox.right);
          const toolboxButtons = hasDataZoom ? 2 : 1;
          const toolboxWidth = toolboxRight + toolboxButtons * toolboxItemSize + (toolboxButtons - 1) * toolboxItemGap;
          toolboxPaddingRight = toolboxWidth + componentGap;
        }

        const targetPadding = [0, toolboxPaddingRight, 0, minLegendLeft];
        const currentLegend = legendModel.option;
        const curPad = currentLegend?.padding;
        const curPadL = Array.isArray(curPad) ? curPad[3] : 0;
        const curPadR = Array.isArray(curPad) ? curPad[1] : 0;

        // Apply horizontal padding clearance & dynamic marker dimensions first so multi-row legend wraps accurately
        if (
          currentLegend?.left !== 'center' ||
          currentLegend?.width !== undefined ||
          currentLegend?.top !== baseTop ||
          currentLegend?.itemHeight !== itemHeight ||
          currentLegend?.itemWidth !== itemWidth ||
          currentLegend?.textStyle?.fontSize !== lineFontSize ||
          curPadL !== minLegendLeft ||
          curPadR !== toolboxPaddingRight
        ) {
          chart.setOption(
            {
              legend: {
                top: baseTop,
                left: 'center',
                width: undefined,
                padding: targetPadding,
                itemHeight,
                itemWidth,
                textStyle: {
                  fontSize: lineFontSize,
                  lineHeight: lineFontSize,
                },
              },
            },
            false,
          );
        }

        const settledGroup = chart['getViewOfComponentModel']?.(legendModel)?.group || legendGroup;
        legendHeight = settledGroup.getBoundingRect?.()?.height || itemHeight;
      }
    }

    const rowOffset = isLegendActive && legendHeight > itemHeight ? legendHeight - itemHeight : 0;
    const targetLineTop = baseTop + rowOffset;
    const targetLineBottom = targetLineTop + itemHeight;
    const outerTop = targetLineBottom + componentGap;

    // 5. Single-pass series classification & bar sizing
    const seriesModels = model.getSeries?.();
    const xAxisOption = model.getComponent('xAxis')?.option;
    const totalCategories = Array.isArray(xAxisOption?.data) ? xAxisOption.data.length : 0;

    // Single-pass series classification
    let shouldCheckEndLabel = hasEndLabel ?? false;
    const barSeriesModels: any[] = [];
    if (Array.isArray(seriesModels)) {
      for (const s of seriesModels) {
        const subType = s?.subType;
        if (subType === 'line') {
          if (!shouldCheckEndLabel && s?.option?.endLabel && s.option.endLabel.show !== false) {
            shouldCheckEndLabel = true;
          }
        } else if (subType === 'bar') {
          barSeriesModels.push(s);
        }
      }
    }

    const currentRight = typeof currentGrid.right === 'number' ? currentGrid.right : 0;
    const dynamicRight = gridWidth > 0 && shouldCheckEndLabel ? computeDynamicEndLabelClearance(seriesModels, xAxisOption, gridWidth, lineFontSize) : undefined;

    // Stream 2: Bars & Stack Totals (Uniform font size from bar width & text measurement)
    const barFontSize = barSeriesModels.length > 0 ? computeUniformBarFontSize(chart, barSeriesModels, gridWidth, totalCategories) : undefined;

    // 5. Inspect typography across axes, legend, dataZoom, and series to detect drift
    const xAxisModels = model.findComponents?.({ mainType: 'xAxis' }) ?? [];
    let hasXAxisFontChange = false;
    for (const ax of xAxisModels) {
      if (ax?.get?.(['axisLabel', 'fontSize']) !== lineFontSize) {
        hasXAxisFontChange = true;
        break;
      }
    }

    const yAxisModels = model.findComponents?.({ mainType: 'yAxis' }) ?? [];
    let hasYAxisFontChange = false;
    for (const ay of yAxisModels) {
      if (ay?.get?.(['axisLabel', 'fontSize']) !== lineFontSize || ay?.get?.(['nameTextStyle', 'fontSize']) !== lineFontSize) {
        hasYAxisFontChange = true;
        break;
      }
    }

    const currentLegendFontSize = legendModel?.get?.(['textStyle', 'fontSize']);
    const hasLegendFontChange = Boolean(isLegendActive && currentLegendFontSize !== lineFontSize);

    const currentDataZoomFontSize = dataZoomModel?.get?.(['textStyle', 'fontSize']);
    const hasDataZoomFontChange = Boolean(hasDataZoom && currentDataZoomFontSize !== lineFontSize);

    // Determine series updates for both streams
    let hasSeriesFontChange = false;
    const seriesUpdates: Record<string, unknown>[] = [];
    if (Array.isArray(seriesModels)) {
      for (const s of seriesModels) {
        const isLine = s?.subType === 'line';
        const isBar = s?.subType === 'bar';
        const opt = s?.option;
        const patch: Record<string, unknown> = {};

        if (isLine) {
          if (opt?.endLabel && opt.endLabel.show !== false && opt.endLabel.fontSize !== lineFontSize) {
            patch.endLabel = { fontSize: lineFontSize };
            hasSeriesFontChange = true;
          }
          if (opt?.label && opt.label.show !== false && opt.label.fontSize !== lineFontSize) {
            patch.label = { fontSize: lineFontSize };
            hasSeriesFontChange = true;
          }
        } else if (isBar && barFontSize !== undefined) {
          if (opt?.label && opt.label.show !== false && opt.label.fontSize !== barFontSize) {
            patch.label = { fontSize: barFontSize };
            hasSeriesFontChange = true;
          }
        }

        if (opt?.id) {
          patch.id = opt.id;
        }
        seriesUpdates.push(patch);
      }
    }

    let targetToolboxTop: number | undefined;
    let needsToolboxUpdate = false;
    if (isToolboxActive && toolboxModel) {
      targetToolboxTop = targetLineTop;
      needsToolboxUpdate = toolboxModel.option?.top !== targetToolboxTop || toolboxModel.option?.itemSize !== toolboxItemSize;
    }

    const needsTopUpdate = currentGrid.top !== outerTop || needsToolboxUpdate;
    const needsRightUpdate = dynamicRight !== undefined && Math.abs(currentRight - dynamicRight) >= CHART_CONFIG.layout.toleranceThreshold;
    const needsTypographyUpdate = hasXAxisFontChange || hasYAxisFontChange || hasLegendFontChange || hasDataZoomFontChange || hasSeriesFontChange;

    // 6. Atomically apply layout updates only when coordinates have drifted
    if (needsTopUpdate || needsRightUpdate || needsTypographyUpdate) {
      const targetRight = needsRightUpdate ? dynamicRight : currentRight;

      const xAxisPatch = xAxisModels.length > 1 ? xAxisModels.map(() => ({ axisLabel: { fontSize: lineFontSize } })) : { axisLabel: { fontSize: lineFontSize } };

      const yAxisPatch =
        yAxisModels.length > 1
          ? yAxisModels.map(() => ({
              axisLabel: { fontSize: lineFontSize },
              nameTextStyle: { fontSize: lineFontSize, lineHeight: lineFontSize },
            }))
          : {
              axisLabel: { fontSize: lineFontSize },
              nameTextStyle: { fontSize: lineFontSize, lineHeight: lineFontSize },
            };

      chart.setOption(
        {
          ...(hasLegendFontChange ? { legend: { itemHeight, itemWidth, textStyle: { fontSize: lineFontSize, lineHeight: lineFontSize } } } : {}),
          ...(needsToolboxUpdate && targetToolboxTop !== undefined ? { toolbox: { top: targetToolboxTop, itemSize: toolboxItemSize } } : {}),
          grid: {
            top: outerTop,
            right: targetRight,
          },
          ...(hasXAxisFontChange ? { xAxis: xAxisPatch } : {}),
          ...(hasYAxisFontChange ? { yAxis: yAxisPatch } : {}),
          ...(hasDataZoomFontChange ? { dataZoom: { textStyle: { fontSize: lineFontSize } } } : {}),
          ...(hasSeriesFontChange ? { series: seriesUpdates } : {}),
        },
        false,
      );
    }
  } catch {
    // Gracefully ignore layout calculation errors on unattached or disposed DOM containers
  }
}

/** Resizes the ECharts canvas instance and synchronizes responsive grid offsets and label clearance. */
export function resizeChart(chart: ECharts | null | undefined): void {
  if (!chart || chart.isDisposed()) return;
  chart.resize();
  adjustChartLayout(chart);
}

/**
 * Applies enhanced ECharts options to the canvas instance with automatic layout adjustment.
 * Executes immediate layout pass followed by post-paint settling notification.
 */
export function renderChart(chart: ECharts | null | undefined, option: EChartsOption, onSettled?: () => void): void {
  if (!chart || chart.isDisposed()) return;
  chart.setOption(option, true);
  adjustChartLayout(chart);
  onSettled?.();
}

interface QueuedChartTask {
  option: EChartsOption;
  onSettled?: () => void;
}

const renderQueue = new Map<ECharts, QueuedChartTask>();
let isQueueProcessing = false;
let queueRafId: number | null = null;

function processNextQueuedRender(): void {
  if (renderQueue.size === 0) {
    isQueueProcessing = false;
    queueRafId = null;
    return;
  }

  isQueueProcessing = true;

  const nextEntry = renderQueue.entries().next().value;
  if (!nextEntry) {
    isQueueProcessing = false;
    queueRafId = null;
    return;
  }

  const [chart, task] = nextEntry;
  renderQueue.delete(chart);

  if (!chart.isDisposed()) {
    renderChart(chart, task.option, task.onSettled);
  }

  if (renderQueue.size > 0) {
    queueRafId = requestAnimationFrame(processNextQueuedRender);
  } else {
    isQueueProcessing = false;
    queueRafId = null;
  }
}

/**
 * Enqueues an enhanced ECharts option render across animation frames.
 * Prevents multiple concurrent charts from freezing the main thread simultaneously
 * by staggering chart rendering to one chart per visual animation frame.
 */
export function queueChartRender(chart: ECharts | null | undefined, option: EChartsOption, onSettled?: () => void): void {
  if (!chart || chart.isDisposed()) return;

  renderQueue.set(chart, { option, onSettled });

  if (!isQueueProcessing) {
    isQueueProcessing = true;
    queueRafId = requestAnimationFrame(processNextQueuedRender);
  }
}

/** Cancels any pending queued render for a specific ECharts canvas instance (e.g. on disposal). */
export function cancelQueuedChartRender(chart: ECharts | null | undefined): void {
  if (!chart) return;
  renderQueue.delete(chart);
  if (renderQueue.size === 0 && queueRafId !== null) {
    cancelAnimationFrame(queueRafId);
    queueRafId = null;
    isQueueProcessing = false;
  }
}

/** Registers standard event listeners on the ECharts canvas instance (e.g. view restore layout recalculation). */
export function bindChartEvents(chart: ECharts | null | undefined): void {
  if (!chart || chart.isDisposed()) return;
  chart.on('restore', () => adjustChartLayout(chart));
}

/* -------------------------------------------------------------------------- */
/* 3. Columnar Transposition & Stacked Bar Series Builders                    */
/* -------------------------------------------------------------------------- */

/** Configuration options for outlier gap detection and axis ceiling resolution. */
export interface OutlierCapOptions {
  /** Multiplier ratio between adjacent ranked values to qualify as an isolated outlier. @default 2.5 */
  ratio?: number;
  /** Additional headroom multiplier added to the effective maximum for chart spacing. @default 1.15 */
  headroom?: number;
  /** Granularity rounding step for the resulting maximum. @default 20 */
  roundStep?: number;
  /** Minimum absolute threshold below which the calculated ceiling will not drop. @default 0 */
  fallbackMin?: number;
  /** Whether to return a calculated ceiling even when no outlier is present. @default false */
  alwaysClamp?: boolean;
}

/**
 * Resolves an effective maximum value from a series of numbers (or a list of parallel series)
 * by detecting and suppressing isolated extreme outliers.
 *
 * When passed a 2D array of series, each series is evaluated independently so that isolated spikes
 * in one metric (e.g. defense or external aid) do not falsely cluster with spikes in another metric,
 * preserving high vertical resolution for normal indicators (e.g. GDP, debt, revenue).
 */
export function resolveEffectiveMax(seriesOrValues: readonly (number | null | undefined)[] | readonly (readonly (number | null | undefined)[])[], options: OutlierCapOptions = {}): number | undefined {
  const is2D = seriesOrValues.length > 0 && Array.isArray(seriesOrValues[0]);
  const seriesList = (is2D ? seriesOrValues : [seriesOrValues]) as readonly (readonly (number | null | undefined)[])[];

  const ratio = options.ratio ?? CHART_CONFIG.outlier.defaultRatio;
  let globalHasOutlier = false;
  let maxEffectiveCeiling = 0;

  for (const series of seriesList) {
    const nums = series.filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    if (nums.length === 0) continue;

    const sorted = [...nums].sort((a, b) => b - a);
    let effective = sorted[0];

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i] > sorted[i + 1] * ratio && sorted[i + 1] > 0) {
        effective = sorted[i + 1];
        globalHasOutlier = true;
      } else {
        break;
      }
    }

    if (effective > maxEffectiveCeiling) {
      maxEffectiveCeiling = effective;
    }
  }

  if (maxEffectiveCeiling === 0) return undefined;
  if (!globalHasOutlier && !options.alwaysClamp) return undefined;

  const headroom = options.headroom ?? CHART_CONFIG.outlier.defaultHeadroom;
  const step = options.roundStep ?? CHART_CONFIG.outlier.defaultRoundStep;
  const fallbackMin = options.fallbackMin ?? CHART_CONFIG.outlier.defaultFallbackMin;

  return Math.max(fallbackMin, Math.ceil((maxEffectiveCeiling * headroom) / step) * step);
}

/**
 * Transposes an object of parallel columnar arrays into an array of row objects.
 * Attaches structured point metadata directly to ECharts series data.
 */
export function zipRecords<T extends Record<string, readonly unknown[]>>(columns: T): Array<{ [K in keyof T]: T[K] extends readonly (infer U)[] ? U : never }> {
  const keys = Object.keys(columns) as (keyof T)[];
  const len = columns[keys[0]]?.length ?? 0;
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    const row: Record<string, unknown> = {};
    for (const key of keys) {
      row[key as string] = columns[key]?.[i];
    }
    result[i] = row;
  }
  return result as Array<{ [K in keyof T]: T[K] extends readonly (infer U)[] ? U : never }>;
}

type ExtractObjects<T> = T extends Record<string, unknown> ? T : never;

/**
 * Automatically extracts the point data object type from series, series array, records array, or arbitrary data source.
 * Filters out raw scalar values (numbers) from mixed series unions, enabling zero-boilerplate type inference.
 */
export type InferPointData<T> = T extends readonly { data?: readonly (infer D)[] }[]
  ? [ExtractObjects<D>] extends [never]
    ? Record<string, unknown>
    : ExtractObjects<D>
  : T extends { data?: readonly (infer D)[] }
    ? [ExtractObjects<D>] extends [never]
      ? Record<string, unknown>
      : ExtractObjects<D>
    : T extends readonly (infer Item)[]
      ? Item extends Record<string, unknown>
        ? Item
        : Record<string, unknown>
      : Record<string, unknown>;

/** Context provided to custom bar item label formatter. */
export interface BarLabelContext<T = unknown> {
  /** Numeric value of the bar segment. */
  value: number;
  /** Category data index along the axis. */
  index: number;
  /** Associated point data object or scalar. */
  item: T;
}

/** Configuration contract for a standalone, clustered, or stacked bar series. */
export type BarSeriesOptions<T = unknown> = Omit<BarSeriesOption, 'data'> & {
  data?: readonly T[];
  /** Formats the label text for each non-zero bar segment. Return empty string or undefined to hide label. */
  formatLabel?: (ctx: BarLabelContext<T>) => string | undefined;
  /** Automatically hides inside labels that overflow the bar geometry. @default true */
  hideIfOverflowBar?: boolean;
  /** Automatically hides labels that overlap with neighboring series or bars. @default true */
  hideOverlap?: boolean;
};

/**
 * Creates a configured ECharts bar series for standalone, clustered, or stacked columns.
 * Supports automated item label formatting while preserving arbitrary point object metadata.
 */
export function createBarSeries<T = unknown>({ formatLabel, label, hideIfOverflowBar, hideOverlap, ...series }: BarSeriesOptions<T>): BarSeriesOption & { data?: readonly T[] } {
  const isStacked = Boolean(series.stack);
  const isInside = label?.position ? String(label.position).startsWith('inside') : isStacked || !label?.position;
  const base = {
    type: 'bar' as const,
    labelLine: { show: false },
    animationDurationUpdate: series.animationDurationUpdate ?? CHART_CONFIG.animation.durationUpdate,
    hideOverlap: hideOverlap !== undefined ? hideOverlap : !isInside,
    hideIfOverflowBar: hideIfOverflowBar !== undefined ? hideIfOverflowBar : isStacked,
    ...series,
  };

  if (!formatLabel) {
    return {
      ...base,
      ...(label ? { label: { position: label.position ?? (isStacked ? 'inside' : undefined), ...label } } : {}),
    } as BarSeriesOption & { data?: readonly T[] };
  }

  return {
    ...base,
    formatLabel,
    data: series.data as BarSeriesOption['data'],
    label: {
      show: true,
      position: label?.position ?? (isStacked ? 'inside' : undefined),
      distance: label?.distance ?? (isStacked ? 5 : CHART_CONFIG.typography.point.distance),
      ...label,
      formatter: (params: CallbackDataParams) => {
        const val = extractPointValue(params.data ?? params.value);
        return val != null && val !== 0 ? (formatLabel({ value: val, index: params.dataIndex, item: (params.data ?? val) as T }) ?? '') : '';
      },
    },
  } as BarSeriesOption & { data?: readonly T[] };
}

/** Configuration options for ranked slot-based bar series. */
export interface RankedBarSeriesOptions<T = unknown> {
  /** Unique ID prefix for series (e.g. 'exp', 'imp', 'categories'). */
  idPrefix: string;
  /** Stack grouping identifier in ECharts. */
  stack: string;
  /** Total number of categories / steps along the X-axis. */
  categoryCount: number;
  /** 2D array: for each category index i (0..categoryCount-1), a ranked list of items. */
  rankedData: readonly (readonly T[] | undefined)[];
  /** Extracts the numeric value for the bar height. */
  getValue: (item: T) => number;
  /** Extracts the bar color. */
  getColor: (item: T) => string;
  /** Extracts the localized name for the point. */
  getName?: (item: T) => string;
  /** Value sign multiplier (+1 for positive stacks, -1 for negative / mirrored stacks). @default 1 */
  sign?: 1 | -1;
  /** Optional custom properties merged into each data point (e.g. for tooltip access). */
  getExtraProps?: (item: T) => Record<string, unknown>;
  /** Optional label configuration overrides. */
  label?: BarSeriesOptions['label'];
  /** Formatter for item labels. When returned text is empty, the label is omitted. */
  formatLabel?: (ctx: { item: T; value: number; index: number }) => string;
}

/**
 * Creates a collection of ranked slot-based bar series for multi-series stacked column charts.
 * Dramatically reduces the number of series in ECharts by assigning each rank position (Slot 1..N)
 * to a single series, dynamically varying colors and labels per data point.
 */
export function createRankedBarSeries<T = unknown>({
  idPrefix,
  stack,
  categoryCount,
  rankedData,
  getValue,
  getColor,
  getName,
  sign = 1,
  getExtraProps,
  label,
  formatLabel,
}: RankedBarSeriesOptions<T>): BarSeriesOption[] {
  let maxSlots = 0;
  for (let i = 0; i < categoryCount; i++) {
    const len = rankedData[i]?.length ?? 0;
    if (len > maxSlots) {
      maxSlots = len;
    }
  }

  const series: BarSeriesOption[] = [];

  for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
    const slotData: Array<Record<string, unknown>> = [];

    for (let i = 0; i < categoryCount; i++) {
      const yearList = rankedData[i];
      const item = yearList ? yearList[slotIdx] : undefined;

      if (item !== undefined) {
        const val = getValue(item);
        const color = getColor(item);
        const name = getName ? getName(item) : '';
        const extra = getExtraProps ? getExtraProps(item) : undefined;

        slotData.push({
          value: [i, sign * val],
          val,
          name,
          color,
          itemStyle: { color },
          item,
          ...extra,
        });
      } else {
        slotData.push({
          value: [i, 0],
          val: 0,
          name: '',
        });
      }
    }

    series.push(
      createBarSeries({
        id: `${idPrefix}-slot-${slotIdx}`,
        name: `Slot ${slotIdx + 1}`,
        stack,
        label: {
          show: true,
          ...label,
        },
        data: slotData,
        formatLabel: formatLabel
          ? ({ value, index, item: point }) => {
              const raw = (point as { item?: T })?.item;
              return raw !== undefined ? formatLabel({ item: raw, value, index }) : '';
            }
          : undefined,
      }),
    );
  }

  return series;
}

/** Specification for a static legend item. */
export interface StaticLegendItem {
  /** Display name of the legend item matching legend.data. */
  name: string;
  /** Color of the legend marker. */
  color: string;
}

/**
 * Creates a static non-interactive ECharts legend option with rounded rectangle markers.
 */
export function createStaticLegend(items: readonly StaticLegendItem[]) {
  return {
    show: true,
    selectedMode: false as const,
    data: items.map((item) => ({
      name: item.name,
      icon: 'roundRect' as const,
      itemStyle: { color: item.color },
    })),
  };
}

/**
 * Creates dummy line series for static legend display in charts where data is grouped into rank slots.
 * Line series with empty data satisfy ECharts legend series-matching without affecting bar column geometry.
 */
export function createStaticLegendSeries(items: readonly StaticLegendItem[]): SeriesOption[] {
  return items.map((item) => ({
    id: `legend-${item.name}`,
    name: item.name,
    type: 'line' as const,
    data: [],
    color: item.color,
    silent: true,
    showSymbol: false,
  }));
}

/** Context provided to stack total label formatter. */
export interface StackTotalContext<T = unknown> {
  /** Computed aggregate sum atop the bar stack. */
  total: number;
  /** Category data index along the axis. */
  index: number;
  /** Associated point data object or scalar of the total anchor. */
  item: T;
}

/** Configuration contract for an invisible zero-height series displaying aggregate totals atop a bar stack. */
export type StackTotalSeriesOptions<T = unknown> = Omit<BarSeriesOption, 'data'> & {
  data?: readonly T[];
  /** Formats the aggregate total label atop the stack. Return empty string or undefined to hide. */
  formatTotal: (ctx: StackTotalContext<T>) => string | undefined;
  /** Automatically hides labels that overlap with neighboring series or bars. @default true */
  hideOverlap?: boolean;
};

/**
 * Creates an invisible zero-height bar series that anchors an aggregate total label
 * directly atop a stacked bar column without altering bar geometry or mouse interactions.
 */
export function createStackTotalSeries<T = unknown>({ formatTotal, label, hideOverlap, ...series }: StackTotalSeriesOptions<T>): BarSeriesOption {
  const rawData = Array.isArray(series.data) ? series.data : [];
  const color = typeof series.color === 'string' ? series.color : 'inherit';
  return {
    type: 'bar',
    silent: true,
    tooltip: { show: false },
    hideOverlap: hideOverlap ?? true,
    hideIfOverflowBar: false,
    formatTotal,
    ...series,
    color,
    label: {
      show: true,
      distance: label?.distance ?? CHART_CONFIG.typography.point.distance,
      color,
      ...label,
      formatter: (params: CallbackDataParams) => {
        const tot = extractPointValue(params.data);
        return (tot != null && tot !== 0 ? formatTotal({ total: tot, index: params.dataIndex, item: params.data as T }) : '') ?? '';
      },
    },
    data: rawData.map((item) => {
      const obj = typeof item === 'object' && item !== null ? item : { value: item };
      const rawVal = obj.value !== undefined ? obj.value : obj;
      const num = extractPointValue(rawVal);
      const pos = label?.position ?? (num !== undefined && num < 0 ? 'bottom' : 'top');
      return {
        ...obj,
        originalValue: obj.value,
        value: 0,
        label: {
          position: pos,
          ...obj.label,
        },
      };
    }),
  } as BarSeriesOption;
}

/* -------------------------------------------------------------------------- */
/* 4. Declarative Tooltip Contexts & Hierarchy                                */
/* -------------------------------------------------------------------------- */

/** Base point context identifying an active category tick along the axis. */
export interface BasePointContext {
  /** Category or period label name (e.g. "2024", "SpaceX"). */
  name: string;
  /** Active category index or coordinate X-axis index. */
  dataIndex: number;
}

/** Context provided to column-level tooltip callbacks (headers, table rows, and table footers). */
export interface TooltipTickContext<TData = Record<string, unknown>> extends BasePointContext {
  /** All series items active at this axis position. */
  items: CallbackDataParams[];
  /** Custom point metadata of the primary (first) active series item at this axis position. */
  data?: TData;
}

/** Context provided to series row formatters. */
export interface TooltipRowContext<TData = Record<string, unknown>> extends BasePointContext {
  /** Series display name (e.g. "Exports", "SpaceX"). */
  seriesName: string;
  /** Series identifier. */
  seriesId: string;
  /** Numeric value of this series at current category. */
  value: number;
  /** Series marker color. */
  color: string;
  /** Custom point metadata (guaranteed object). */
  data: TData;
}

/** Preset configuration for automatic ratio footer. */
export interface TooltipRatioFooter {
  /** Enables automatic ratio calculation between positive and negative groups. */
  type: 'ratio';
  /** Summary row label text (e.g. "Ratio (RF : UA)"). */
  label: string;
  /** Mandatory localized ratio formatter (e.g. `fmt.ratio`). */
  format: (a: number, b?: number, digits?: number) => string;
  /** Summary value color token or Tailwind class. @default 'warning' */
  color?: SemanticColor | (string & {});
  /** Decimal precision for ratio calculation. @default 1 */
  precision?: number;
}

/** Context provided to custom axis tooltip footer callbacks. Extends TooltipTickContext. */
export interface AxisTooltipFooterContext<TData = Record<string, unknown>> extends TooltipTickContext<TData> {
  /** Computed sum of all non-null series values at current category. */
  sum: number;
  /** Number of visible series rows rendered in the tooltip. */
  count: number;
}

/** Return type for declarative tooltip header generator callbacks. */
export type TooltipHeaderResult = string | { title: string; icon?: string };

export type AxisTooltipFooter<TData = Record<string, unknown>> = (ctx: AxisTooltipFooterContext<TData>) => TooltipFooterSpec | undefined;

/** Declarative configuration contract for axis-triggered tooltips. */
export interface AxisTooltipSpec<TData = Record<string, unknown>> {
  /** Tooltip visualization strategy. */
  type: 'axis';
  /** Title generator for the header block. Defaults to item.name if omitted. */
  header?: (ctx: TooltipTickContext<TData>) => TooltipHeaderResult;
  /** Row formatter callback. Return undefined to exclude series item from tooltip. */
  row: (ctx: TooltipRowContext<TData>) => TooltipRowSpec | undefined;
  /** Optional series sorting: 'desc' (highest first) | 'asc' (lowest first). Preserves original order if omitted. */
  sort?: 'desc' | 'asc';
  /** Optional footer row (e.g. Total sum, preset sum, or custom callback). */
  footer?: AxisTooltipFooter<TData>;
  /** Optional ECharts tooltip component options to merge (e.g. axisPointer). */
  axisPointer?: TooltipComponentOption['axisPointer'];
}

/** Context provided to dual group total generator callback. Extends TooltipTickContext. */
export interface DualGroupTotalContext<TData = Record<string, unknown>> extends TooltipTickContext<TData> {
  /** Computed absolute sum of non-zero values in this group. */
  sum: number;
}

/** Configuration contract for one branch/group (positive or negative) of a dual tooltip. */
export interface DualGroupConfig<TData = Record<string, unknown>> {
  /** Section heading title (e.g. "Exports", "Russian Strikes"). */
  title: string;
  /** Section heading color token, Tailwind class, or hex color. */
  color?: SemanticColor | (string & {});
  /** Formatted group total (or dynamic generator / boolean flag to show auto-computed sum). */
  total?: boolean | string | number | ((ctx: DualGroupTotalContext<TData>) => string | number);
}

/** Context provided to custom dual tooltip footer callbacks. Extends BasePointContext. */
export interface DualTooltipFooterContext<TData = Record<string, unknown>> extends BasePointContext {
  /** Computed absolute sum of non-zero positive group values. */
  posSum: number;
  /** Computed absolute sum of non-zero negative group values. */
  negSum: number;
  /** Filtered series items belonging to positive group. */
  posItems: CallbackDataParams[];
  /** Filtered series items belonging to negative group. */
  negItems: CallbackDataParams[];
  /** Custom point metadata of the primary (first) active series item at this axis position. */
  data?: TData;
}

/** Supported footer configurations for dual/diverging chart tooltips. */
export type DualTooltipFooter<TData = Record<string, unknown>> = TooltipRatioFooter | ((ctx: DualTooltipFooterContext<TData>) => TooltipFooterSpec | undefined);

/** Declarative configuration contract for dual/diverging (positive vs negative) chart tooltips. */
export interface DualTooltipSpec<TData = Record<string, unknown>> {
  /** Tooltip visualization strategy. */
  type: 'dual';
  /** Title generator for the header block. Defaults to item.name if omitted. */
  header?: (ctx: TooltipTickContext<TData>) => TooltipHeaderResult;
  /** Positive (upper / >= 0) group specification. */
  positive: DualGroupConfig<TData>;
  /** Negative (lower / < 0) group specification. */
  negative: DualGroupConfig<TData>;
  /** Unified row formatter callback applied across all series items in both groups. Return undefined to skip. */
  row?: (ctx: TooltipRowContext<TData>) => TooltipRowSpec | undefined;
  /** Simple numeric value formatter. When row is omitted, renders standard rows automatically with Math.abs(). */
  formatValue?: (value: number) => string;
  /** Sorting within each group: 'desc' (highest magnitude first) | 'asc'. Defaults to 'desc'. */
  sort?: 'desc' | 'asc';
  /** Optional summary footer row (e.g. Net balance, automatic Ratio preset, or custom callback). */
  footer?: DualTooltipFooter<TData>;
  /** Optional ECharts tooltip component options to merge (e.g. axisPointer). */
  axisPointer?: TooltipComponentOption['axisPointer'];
}

/** Declarative configuration contract for multi-column tabular tooltips. */
export interface TableTooltipSpec<TData = Record<string, unknown>> {
  /** Tooltip visualization strategy. */
  type: 'table';
  /** Title generator for the header block. Defaults to item.name if omitted. */
  header?: (ctx: TooltipTickContext<TData>) => TooltipHeaderResult;
  /** Column definitions for the table. */
  columns: TooltipColumnSpec[];
  /** Row generator callback producing formatted table rows. */
  rows: (ctx: TooltipTickContext<TData>) => TooltipTableRowSpec[];
  /** Optional summary footer generator callback. */
  footer?: (ctx: TooltipTickContext<TData>) => TooltipTableRowSpec | undefined;
  /** Optional ECharts tooltip component options to merge (e.g. axisPointer). */
  axisPointer?: TooltipComponentOption['axisPointer'];
}

/** Discriminated union of declarative chart tooltip specifications. */
export type ChartTooltipSpec<TData = Record<string, unknown>> = AxisTooltipSpec<TData> | DualTooltipSpec<TData> | TableTooltipSpec<TData>;

/** Configuration options for `chartOption`, providing automatic point data type inference and declarative tooltip integration. */
export interface SmartChartOption<S extends readonly SeriesOption[] | SeriesOption = readonly SeriesOption[]> extends Omit<EChartsOption, 'series' | 'tooltip'> {
  /** Visualization series or series array. Contextually types point data in tooltip callbacks. */
  series: S;
  /** Declarative tooltip specification or standard raw ECharts tooltip options. */
  tooltip?: ChartTooltipSpec<InferPointData<S>> | TooltipComponentOption;
}

/* -------------------------------------------------------------------------- */
/* 5. Tooltip Rendering Engine & Option Builder                               */
/* -------------------------------------------------------------------------- */

/** Resolves dual tooltip footer contract or dynamic ratio calculation. */
function resolveDualFooter<TData>(footer: DualTooltipFooter<TData> | undefined, ctx: DualTooltipFooterContext<TData>): TooltipFooterSpec | undefined {
  if (!footer) return undefined;
  if (typeof footer === 'function') return footer(ctx);
  if (ctx.posSum <= 0 || ctx.negSum <= 0) return undefined;
  const ratioStr = footer.format(ctx.posSum, ctx.negSum, footer.precision);
  return ratioStr ? { label: footer.label, value: ratioStr, color: footer.color ?? 'warning' } : undefined;
}

/** Normalizes polymorphic ECharts tooltip params and constructs the active tick context. */
function unwrapTick<TData>(params: unknown, headerFn?: (ctx: TooltipTickContext<TData>) => TooltipHeaderResult): { title: string; icon?: string; ctx: TooltipTickContext<TData> } | null {
  const items = (Array.isArray(params) ? params : [params]) as CallbackDataParams[];
  if (!items.length) return null;

  const first = items[0] as (CallbackDataParams & { axisValueLabel?: string; axisValue?: string | number }) | undefined;
  const name = String(first?.axisValueLabel ?? first?.axisValue ?? first?.name ?? '');

  let dataIndex = first?.dataIndex ?? 0;
  for (const item of items) {
    const rawVal = Array.isArray(item.value) ? item.value[0] : (item.value as { value?: unknown })?.value;
    const coordX = Array.isArray(rawVal) ? rawVal[0] : rawVal;
    if (typeof coordX === 'number' && Number.isInteger(coordX)) {
      dataIndex = coordX;
      break;
    }
  }

  const data = (typeof first?.data === 'object' && first?.data !== null ? first.data : {}) as TData;
  const ctx: TooltipTickContext<TData> = { name, dataIndex, items, data };
  const headerRes = headerFn ? headerFn(ctx) : name;
  const title = typeof headerRes === 'object' && headerRes !== null ? headerRes.title : String(headerRes ?? name);
  const icon = typeof headerRes === 'object' && headerRes !== null ? headerRes.icon : undefined;
  return { title, icon, ctx };
}

/** Renders a list of series rows with value extraction, formatting, sorting, and aggregation. */
function renderRows<TData>(
  items: CallbackDataParams[],
  tickCtx: TooltipTickContext<TData>,
  rowFn?: (ctx: TooltipRowContext<TData>) => TooltipRowSpec | undefined,
  valueFn?: (val: number) => string,
  sort: 'desc' | 'asc' = 'desc',
  isAbs = false,
): { html: string; sum: number; count: number } {
  const sorted = [...items].sort((a, b) => {
    const vA = extractPointValue(a.data ?? a.value) ?? 0;
    const vB = extractPointValue(b.data ?? b.value) ?? 0;
    const compA = isAbs ? Math.abs(vA) : vA;
    const compB = isAbs ? Math.abs(vB) : vB;
    return sort === 'desc' ? compB - compA : compA - compB;
  });

  let sum = 0;
  let count = 0;
  const rowsHtml: string[] = [];

  for (const item of sorted) {
    const raw = extractPointValue(item.data ?? item.value);
    if (raw === undefined || Number.isNaN(raw)) continue;
    const num = isAbs ? Math.abs(raw) : raw;

    const seriesName = String(item.seriesName ?? '');
    const seriesId = String(item.seriesId ?? '');
    const name = String(item.name ?? tickCtx.name);
    const dataObj = typeof item.data === 'object' && item.data !== null ? (item.data as Record<string, unknown>) : null;
    const data = (dataObj ?? {}) as TData;
    const fallbackName = typeof dataObj?.name === 'string' ? dataObj.name : seriesName;
    const itemColor = typeof dataObj?.color === 'string' ? dataObj.color : String(item.color ?? 'var(--color-accent-primary)');

    if (rowFn) {
      const row = rowFn({ seriesName: fallbackName, value: num, color: itemColor, seriesId, name, dataIndex: tickCtx.dataIndex, data });
      if (!row) continue;
      rowsHtml.push(renderTooltipRow(row, fallbackName, itemColor));
    } else if (valueFn && num > 0) {
      rowsHtml.push(renderTooltipRow({ value: valueFn(num) }, fallbackName, itemColor));
    } else {
      continue;
    }

    sum += num;
    count++;
  }

  return { html: rowsHtml.join(''), sum, count };
}

/** Formatter generator for axis-triggered tooltips. */
function buildAxisTooltip<TData>(config: AxisTooltipSpec<TData>): (params: unknown) => string {
  return (params: unknown) => {
    const tick = unwrapTick<TData>(params, config.header);
    if (!tick) return '';

    const { html, sum, count } = renderRows(tick.ctx.items, tick.ctx, config.row, undefined, config.sort ?? 'desc');
    if (!count) return '';

    const headerHtml = renderTooltipHeader({ title: tick.title, icon: tick.icon });
    const footerHtml = renderTooltipFooter(config.footer?.({ ...tick.ctx, sum, count }));
    return `<div class="min-w-45 w-max">${headerHtml}<div class="space-y-1">${html}</div>${footerHtml}</div>`;
  };
}

/** Formatter generator for dual/diverging chart tooltips. */
function buildDualTooltip<TData>(config: DualTooltipSpec<TData>): (params: unknown) => string {
  return (params: unknown) => {
    const tick = unwrapTick<TData>(params, config.header);
    if (!tick) return '';

    const posItems: CallbackDataParams[] = [];
    const negItems: CallbackDataParams[] = [];
    for (const item of tick.ctx.items) {
      const num = Number(extractPointValue(item.data ?? item.value));
      if (num < 0 || String(item.seriesId).startsWith('imp')) negItems.push(item);
      else if (num > 0 || String(item.seriesId).startsWith('exp')) posItems.push(item);
    }

    const renderBranch = (group: DualGroupConfig<TData>, items: CallbackDataParams[]): { html: string; sum: number } => {
      const { html, sum } = renderRows(items, tick.ctx, config.row, config.formatValue, config.sort ?? 'desc', true);
      if (!html) return { html: '', sum: 0 };
      const { className, styleAttr } = resolveColor(group.color);
      let totalText = '';
      if (typeof group.total === 'function') totalText = String(group.total({ ...tick.ctx, items, sum }));
      else if (group.total === true) totalText = config.formatValue ? config.formatValue(sum) : String(sum);
      else if (typeof group.total === 'string') totalText = group.total;

      const header = `<div class="font-bold text-2xs uppercase tracking-wider flex justify-between gap-4 mb-1 whitespace-nowrap ${className}"${styleAttr}><span>${group.title}</span>${totalText ? `<span>${totalText}</span>` : ''}</div>`;
      return { html: `<div class="mb-2">${header}<div class="space-y-0.5">${html}</div></div>`, sum };
    };

    const pos = renderBranch(config.positive, posItems);
    const neg = renderBranch(config.negative, negItems);
    if (!pos.html && !neg.html) return '';

    const headerHtml = renderTooltipHeader({ title: tick.title, icon: tick.icon });
    const footer = resolveDualFooter(config.footer, { ...tick.ctx, posSum: pos.sum, negSum: neg.sum, posItems, negItems });
    const footerHtml = renderTooltipFooter(footer);
    return `<div class="min-w-50 w-max">${headerHtml}${pos.html}${neg.html}${footerHtml}</div>`;
  };
}

/** Formatter generator for multi-column tabular tooltips. */
function buildTableTooltip<TData>(config: TableTooltipSpec<TData>): (params: unknown) => string {
  return (params: unknown) => {
    const tick = unwrapTick<TData>(params, config.header);
    if (!tick) return '';

    const rowSpecs = config.rows(tick.ctx);
    if (!rowSpecs.length) return '';

    const headerHtml = renderTooltipHeader({ title: tick.title, icon: tick.icon, withBorder: true, size: 'sm' });
    const tableHtml = renderTooltipTableStructure({
      columns: config.columns,
      rows: rowSpecs,
      footer: config.footer?.(tick.ctx),
    });

    return `<div class="text-xs min-w-60 w-max p-0.5">${headerHtml}${tableHtml}</div>`;
  };
}

/** Factory resolving declarative chart tooltip specification into ECharts HTML formatter callback. */
function buildDeclarativeTooltip<TData>(spec: ChartTooltipSpec<TData>): (params: unknown) => string {
  switch (spec.type) {
    case 'axis':
      return buildAxisTooltip(spec);
    case 'dual':
      return buildDualTooltip(spec);
    case 'table':
      return buildTableTooltip(spec);
  }
}

/** Type guard checking whether a tooltip option is a declarative chart tooltip specification. */
function isDeclarativeTooltip<TData>(tooltip: ChartTooltipSpec<TData> | TooltipComponentOption | undefined): tooltip is ChartTooltipSpec<TData> {
  return tooltip !== null && typeof tooltip === 'object' && 'type' in tooltip && (tooltip.type === 'axis' || tooltip.type === 'dual' || tooltip.type === 'table');
}

/**
 * Constructs a fully type-safe ECharts option object with automatic point metadata inference for tooltips.
 * Eliminates redundant boilerplate (trigger, axisPointer, explicit type annotations) while preserving full ECharts flexibility.
 */
export function chartOption<S extends readonly SeriesOption[] | SeriesOption>(config: SmartChartOption<S>): EChartsOption {
  const { series, tooltip: tooltipSpec, ...rest } = config;

  let resolvedTooltip: TooltipComponentOption | undefined;

  if (tooltipSpec) {
    if (isDeclarativeTooltip(tooltipSpec)) {
      resolvedTooltip = {
        trigger: 'axis',
        formatter: buildDeclarativeTooltip(tooltipSpec),
        ...(tooltipSpec.axisPointer ? { axisPointer: tooltipSpec.axisPointer } : {}),
      };
    } else {
      resolvedTooltip = tooltipSpec;
    }
  }

  return {
    ...rest,
    ...(resolvedTooltip ? { tooltip: resolvedTooltip } : {}),
    series: (Array.isArray(series) ? [...series] : series) as EChartsOption['series'],
  };
}
