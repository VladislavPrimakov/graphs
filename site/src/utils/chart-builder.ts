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
  TitleComponentOption,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import { type ThemeColors, themeFonts } from '@/styles/tokens';
import { resolveColor, type SemanticColor } from '@/utils/color';
import {
  renderTooltipDot,
  renderTooltipFooter,
  renderTooltipHeader,
  renderTooltipRow,
  renderTooltipTableStructure,
  type TooltipColumnSpec as TableColumnSpec,
  type TooltipTableRowSpec as TableRowSpec,
  type TooltipFooterSpec,
  type TooltipRowSpec,
} from './tooltip-builder';

export type { TableColumnSpec, TableRowSpec, TooltipFooterSpec, TooltipRowSpec };

/* -------------------------------------------------------------------------- */
/* 1. Canvas Theme Invariants & Styling Presets                               */
/* -------------------------------------------------------------------------- */

/** Geometric layout metrics and tolerance thresholds shared across options and runtime adjustments. */
const CANVAS_LAYOUT = {
  /** Reserved clearance in pixels for top card controls (floating anchor copy button and filter pills). @default 28 */
  cardControlsHeight: 28,
  /** Default vertical spacing in pixels between card header and chart components (legend / Y-axis). @default 12 */
  layoutGap: 12,
} as const;

/** Resolves theme invariants providing typography, borders, and grid boundaries for a concrete theme palette. */
function getCanvasInvariants(tokens: ThemeColors) {
  return {
    fontFamily: themeFonts.sansFamily,
    layout: CANVAS_LAYOUT,
    legend: {
      left: 'center',
      padding: 0,
      itemHeight: 12,
      itemWidth: 20,
      itemGap: 4,
      textStyle: {
        color: tokens.text.secondary,
        fontSize: 12,
        lineHeight: 12,
        fontFamily: themeFonts.sansFamily,
      },
    } satisfies LegendComponentOption,
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
      outerBounds: {
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
      },
      outerBoundsContain: 'all',
    } satisfies GridComponentOption,
    xAxis: {
      axisLabel: {
        color: tokens.text.secondary,
        fontSize: 12,
      },
      axisLine: {
        lineStyle: { color: tokens.border.muted },
      },
    } satisfies XAXisComponentOption,
    yAxis: {
      nameLocation: 'end',
      nameGap: 12,
      nameTextStyle: {
        color: tokens.text.muted,
        fontSize: 12,
        lineHeight: 12,
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
    } satisfies YAXisComponentOption,
    toolbox: {
      right: 12,
      itemSize: 12,
      itemGap: 8,
      padding: 0,
    },
    tooltip: {
      confine: true,
      extraCssText: [
        `background: ${tokens.surface.overlay}`,
        `border: 1px solid ${tokens.border.muted}`,
        'border-radius: 8px',
        'padding: 10px 14px',
        `color: ${tokens.text.primary}`,
        `font-family: ${themeFonts.sansFamily}`,
        'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35)',
        'backdrop-filter: blur(8px)',
        'pointer-events: none',
      ].join('; '),
    } satisfies TooltipComponentOption,
  };
}

/** Resolves opt-in feature templates applied only when explicitly declared in the user option. */
function getOptInTemplates(tokens: ThemeColors) {
  return {
    title: {
      left: 'center',
      top: 0,
      padding: 0,
      textStyle: {
        color: tokens.text.primary,
        fontSize: 16,
        lineHeight: 28,
        fontFamily: themeFonts.sansFamily,
      },
      subtextStyle: {
        color: tokens.text.muted,
        fontSize: 12,
        lineHeight: 14,
        fontFamily: themeFonts.sansFamily,
      },
      itemGap: 4,
    } satisfies TitleComponentOption,
    dataZoom: {
      bottom: 4,
      height: 22,
      borderColor: tokens.border.muted,
      fillerColor: tokens.accent.glow,
      handleStyle: { color: tokens.accent.primary },
      textStyle: { color: tokens.text.muted },
    } satisfies SliderDataZoomComponentOption,
  };
}

/** Resolves default contrast outline stroke and bold typography applied to data labels across charts. */
/** Default series label typography and outline styling contract. */
export interface SeriesLabelStyle {
  fontFamily: string;
  fontWeight: string;
  color: string;
  textBorderColor: string;
  textBorderWidth: number;
}

function getDefaultLabelStyle(tokens: ThemeColors): SeriesLabelStyle {
  return {
    fontFamily: themeFonts.sansFamily,
    fontWeight: 'bold',
    color: tokens.text.primary,
    textBorderColor: tokens.surface.card,
    textBorderWidth: 2,
  };
}

/** Default styling for line series end labels (e.g. world economic indicators). */
const DEFAULT_END_LABEL_STYLE = {
  fontFamily: themeFonts.sansFamily,
  fontWeight: 'bold',
  color: 'inherit',
  fontSize: 12,
  distance: 4,
  valueAnimation: false,
};

/** Base default geometric presets for line series. */
const THEME_LINE: Partial<LineSeriesOption> = {
  smooth: true,
  symbol: 'circle',
  symbolSize: 6,
  lineStyle: { width: 2.5 },
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
    const val =
      'total' in item ? (item as { total: unknown }).total : 'originalValue' in item ? (item as { originalValue: unknown }).originalValue : 'value' in item ? (item as { value: unknown }).value : item;
    if (typeof val === 'number') return val;
    if (Array.isArray(val)) {
      const v = val.length > 1 ? val[1] : val[0];
      return typeof v === 'number' ? v : undefined;
    }
  }
  return undefined;
}

/** Scans series data for positive/negative values with early exit and zero array allocations. */
function getSeriesSign(data?: BarSeriesOption['data']): { hasPositive: boolean; hasNegative: boolean } {
  let hasPositive = false;
  let hasNegative = false;
  if (!data) return { hasPositive, hasNegative };
  for (const item of data) {
    const val = extractPointValue(item);
    if (val !== undefined) {
      if (val > 0) hasPositive = true;
      else if (val < 0) hasNegative = true;
      if (hasPositive && hasNegative) break;
    }
  }
  return { hasPositive, hasNegative };
}

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
    const group = stackGroups.get(stackKey) ?? [];
    group.push(bar);
    stackGroups.set(stackKey, group);
  }

  for (const [stackKey, group] of stackGroups.entries()) {
    if (!stackKey) {
      // Standalone bars
      for (const s of group) {
        if (s.itemStyle?.borderRadius !== undefined) continue;
        const { hasPositive, hasNegative } = getSeriesSign(s.data);
        s.itemStyle = { ...s.itemStyle, borderRadius: hasNegative && !hasPositive ? [0, 0, 4, 4] : [4, 4, 0, 0] };
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
        const radius = s === topPos ? [4, 4, 0, 0] : s === botNeg ? [0, 0, 4, 4] : 0;
        s.itemStyle = { ...s.itemStyle, borderRadius: radius };
      }
    }
  }
}

/**
 * Recursively merges a base default theme specification with a user override.
 * Automatically broadcasts a single template object across array overrides (e.g. 1-to-N dual axes or dataZooms).
 */
// biome-ignore lint/suspicious/noExplicitAny: polymorphic recursive merge across diverse ECharts options and array structures
function smartMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (override === null || typeof override !== 'object') return override;

  if (Array.isArray(override) && !Array.isArray(base) && typeof base === 'object' && base !== null) {
    return override.map((item) => smartMerge(base, item));
  }

  if (Array.isArray(override) && Array.isArray(base)) {
    return override.map((item, idx) => smartMerge(base[idx], item));
  }

  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    if (overrideVal !== undefined) {
      result[key] = key in result ? smartMerge(result[key], overrideVal) : overrideVal;
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
  }

  if (Array.isArray(enhanced.data) && enhanced.data.some((item) => item && typeof item === 'object' && 'label' in item && item.label)) {
    enhanced.data = enhanced.data.map((item) => (item && typeof item === 'object' && 'label' in item && item.label ? { ...item, label: smartMerge(labelStyle, item.label) } : item));
  }

  // Handle labelLayout collision resolution & optional bar overflow auto-hiding
  const labelObj = 'label' in enhanced && enhanced.label ? (enhanced.label as { show?: boolean; position?: unknown }) : undefined;
  const hasVisibleLabel = Boolean(labelObj && labelObj.show !== false);
  const userFn = typeof enhanced.labelLayout === 'function' ? (enhanced.labelLayout as LabelLayoutOptionCallback) : undefined;
  const userLayoutObj = typeof enhanced.labelLayout === 'object' && enhanced.labelLayout !== null ? (enhanced.labelLayout as ReturnType<LabelLayoutOptionCallback>) : undefined;

  // Only attach labelLayout hook if labels are active or custom layout callback is defined
  if (hasVisibleLabel || userFn || userLayoutObj) {
    const isBar = enhanced.type === 'bar';
    const rawHideIfOverflow = (enhanced as { hideIfOverflowBar?: boolean }).hideIfOverflowBar;
    const hideIfOverflow = isBar ? rawHideIfOverflow !== false : false;
    const rawHideOverlap = (enhanced as { hideOverlap?: boolean }).hideOverlap;
    const hideOverlap = rawHideOverlap !== undefined ? rawHideOverlap : true;
    const labelPos = typeof labelObj?.position === 'string' ? labelObj.position : undefined;
    const isInsideLabel = !labelPos || labelPos.startsWith('inside');

    enhanced.labelLayout = (params: LabelLayoutOptionCallbackParams) => {
      const userRes = userFn ? userFn(params) : userLayoutObj;

      if (hideIfOverflow && isInsideLabel && params.rect && params.labelRect) {
        const barWidth = Math.abs(params.rect.width);
        const barHeight = Math.abs(params.rect.height);
        const labelWidth = Math.abs(params.labelRect.width);
        const labelHeight = Math.abs(params.labelRect.height);

        if (labelHeight > 0 && labelWidth > 0) {
          const isOverflow = barWidth + 1 < labelWidth || barHeight + 1 < labelHeight;

          if (isOverflow) {
            return {
              hideOverlap,
              ...userRes,
              fontSize: 0,
            };
          }
        }
      }

      return {
        hideOverlap,
        ...userRes,
      };
    };
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

/** Computes dynamic vertical layout offsets for title, legend, grid, and toolbox to prevent visual collisions. */
function computeLayoutOffsets(option: EChartsOption, controlsHeight = 0) {
  const optTitle = Array.isArray(option.title) ? option.title[0] : option.title;
  const hasTitle = Boolean(optTitle && optTitle.show !== false && optTitle.text);
  const titleHeight = hasTitle ? (optTitle?.subtext ? 42 : 26) : 0;
  const headerClearance = Math.max(titleHeight, controlsHeight || CANVAS_LAYOUT.cardControlsHeight);

  const optLegend = Array.isArray(option.legend) ? option.legend[0] : option.legend;
  const isShowLegend = optLegend?.show !== false;

  const layoutGap = CANVAS_LAYOUT.layoutGap;
  const legendTop = headerClearance + layoutGap;
  const initialOuterTop = legendTop;

  return {
    legendTop,
    initialOuterTop,
    initialToolboxTop: initialOuterTop,
    isShowLegend,
  };
}

/** Localized action button labels for ECharts toolbox. */
export interface ToolboxLabels {
  /** Label for data zoom / view reset button. @default 'Restore' */
  restore?: string;
  /** Label for exporting canvas to PNG image. @default 'Export PNG' */
  exportPng?: string;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidthCache = new Map<string, number>();

/** Measures pixel width of a rendered text string using a shared offscreen canvas context with LRU-bounded cache. */
function measureTextWidth(text: string, font = `bold 12px ${themeFonts.sansFamily}`): number {
  const cacheKey = `${font}:${text}`;
  const cached = textWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let width = text.length * 8;
  if (typeof document !== 'undefined') {
    if (!measureCtx) {
      const canvas = document.createElement('canvas');
      measureCtx = canvas.getContext('2d');
    }
    if (measureCtx) {
      if (measureCtx.font !== font) {
        measureCtx.font = font;
      }
      width = measureCtx.measureText(text).width;
    }
  }

  if (textWidthCache.size > 500) textWidthCache.clear();
  textWidthCache.set(cacheKey, width);
  return width;
}

/** Resolves the last valid data point index and formatted endLabel text of a line series. */
// biome-ignore lint/suspicious/noExplicitAny: polymorphic ECharts series inspection
function resolveLastEndLabel(item: any): { text: string; lastIndex: number } | null {
  if (!item?.endLabel || item.endLabel.show === false) return null;
  const data = Array.isArray(item.data) ? item.data : [];
  let lastVal: unknown;
  let lastIndex = -1;

  for (let i = data.length - 1; i >= 0; i--) {
    const rawPoint = data[i];
    const val = typeof rawPoint === 'object' && rawPoint !== null && 'value' in rawPoint ? rawPoint.value : rawPoint;
    if (val !== null && val !== undefined && (typeof val !== 'number' || !Number.isNaN(val))) {
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
function computeDynamicEndLabelClearance(
  // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection
  seriesModels: any[],
  // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection
  xAxisOption: any,
  gridWidth: number,
): number {
  if (!seriesModels?.length) return 0;

  const endLabelSeries = seriesModels.filter((s) => s?.subType === 'line' && s?.option?.endLabel && s.option.endLabel.show !== false);
  if (!endLabelSeries.length) return 0;

  const xAxisData = xAxisOption && 'data' in xAxisOption && Array.isArray(xAxisOption.data) ? xAxisOption.data : undefined;
  let totalPoints = xAxisData?.length ?? 0;
  if (!totalPoints) {
    for (const s of endLabelSeries) {
      const len = Array.isArray(s.option?.data) ? s.option.data.length : 0;
      if (len > totalPoints) totalPoints = len;
    }
  }

  const isBoundaryGap = Boolean(xAxisOption?.boundaryGap === true);
  const tickStep = gridWidth > 0 && totalPoints > (isBoundaryGap ? 0 : 1) ? gridWidth / (isBoundaryGap ? totalPoints : totalPoints - 1) : 0;

  let maxOverhang = 0;

  for (const s of endLabelSeries) {
    const item = s.option;
    const resolved = resolveLastEndLabel(item);
    if (!resolved) continue;

    const distance = typeof item.endLabel.distance === 'number' ? item.endLabel.distance : DEFAULT_END_LABEL_STYLE.distance;
    const totalLabelSpan = measureTextWidth(resolved.text) + distance;
    const distToRight = tickStep > 0 ? (totalPoints - 1 - resolved.lastIndex + (isBoundaryGap ? 0.5 : 0)) * tickStep : 0;

    const overhang = totalLabelSpan - distToRight;
    if (overhang > maxOverhang) {
      maxOverhang = overhang;
    }
  }

  return maxOverhang > 0 ? Math.ceil(maxOverhang) : 0;
}

/** Recursively enhances an axis definition (or array of axes) with canvas theme invariants. */
function enhanceAxis<T extends XAXisComponentOption | YAXisComponentOption>(axis: T | T[] | undefined, invariants: T): T | T[] | undefined {
  if (!axis) return invariants;
  const enhanceSingle = (ax: T): T => smartMerge(invariants, ax);
  return Array.isArray(axis) ? (axis.map(enhanceSingle) as T[]) : enhanceSingle(axis);
}

/** Merges user-specified native ECharts option with theme defaults, fonts, and localized export controls. */
export function enhanceOption(option: EChartsOption, labels: ToolboxLabels, exportName: string, tokens: ThemeColors, controlsHeight = 0): EChartsOption {
  const invariants = getCanvasInvariants(tokens);
  const optInTemplates = getOptInTemplates(tokens);
  const defaultLabelStyle = getDefaultLabelStyle(tokens);
  const layout = computeLayoutOffsets(option, controlsHeight);
  const dataZoomArr = Array.isArray(option.dataZoom) ? option.dataZoom : option.dataZoom ? [option.dataZoom] : [];
  const hasDataZoom = dataZoomArr.some((dz) => dz && typeof dz === 'object' && ('show' in dz ? dz.show !== false : 'disabled' in dz ? !dz.disabled : true));
  const optTooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
  const endLabelClearance = computeEndLabelClearance(option.series);

  const toolboxDefaults = {
    right: invariants.toolbox.right,
    top: layout.initialToolboxTop,
    itemSize: invariants.toolbox.itemSize,
    itemGap: invariants.toolbox.itemGap,
    padding: invariants.toolbox.padding,
    iconStyle: { borderColor: tokens.text.muted },
    emphasis: { iconStyle: { borderColor: tokens.accent.primary } },
    feature: {
      ...(hasDataZoom ? { restore: { title: labels.restore ?? 'Restore' } } : {}),
      saveAsImage: {
        name: exportName,
        title: labels.exportPng ?? 'Export PNG',
        pixelRatio: 2,
        backgroundColor: tokens.surface.card,
      },
    },
  };

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: invariants.fontFamily, ...option.textStyle },
    title: option.title ? smartMerge(optInTemplates.title, option.title) : undefined,
    legend: layout.isShowLegend ? smartMerge({ ...invariants.legend, top: layout.legendTop }, option.legend || {}) : { show: false },
    grid: smartMerge(
      {
        ...invariants.grid,
        top: 0,
        right: endLabelClearance,
        bottom: hasDataZoom ? 40 : 0,
        outerBounds: {
          ...invariants.grid.outerBounds,
          top: layout.initialOuterTop,
          right: endLabelClearance,
          bottom: hasDataZoom ? 40 : 0,
        },
      },
      option.grid || {},
    ),
    xAxis: enhanceAxis(option.xAxis, invariants.xAxis),
    yAxis: enhanceAxis(option.yAxis, invariants.yAxis),
    series: enhanceSeries(option.series, defaultLabelStyle),
    dataZoom: option.dataZoom ? smartMerge(optInTemplates.dataZoom, option.dataZoom) : undefined,
    tooltip: optTooltip?.show === false ? { show: false } : smartMerge(invariants.tooltip, option.tooltip || {}),
    toolbox: smartMerge(toolboxDefaults, option.toolbox || {}),
  };
}

/** Dynamically adjusts ECharts grid offsets (top for multi-line legends, right for endLabels) based on actual canvas dimensions. */
export function adjustChartLayout(chart: ECharts, hasEndLabel?: boolean): void {
  try {
    if (!chart || chart.isDisposed()) return;

    // 1. Inspect internal ECharts global model
    // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection for dynamic layout calculations
    const model = (chart as any).getModel?.();
    if (!model) return;

    const gridModel = model.getComponent('grid');
    const currentGrid = gridModel?.option;
    const legendModel = model.getComponent('legend');
    const toolboxModel = model.getComponent('toolbox');

    // 2. Baseline vertical alignment established in enhanceOption (all 3 elements share baseTop)
    const baseTop = Number(legendModel?.get('top') ?? currentGrid?.outerBounds?.top ?? 0);
    let outerTop = baseTop;
    let legendUpdate: Record<string, unknown> | null = null;

    // 3. Resolve horizontal boundaries and multi-line wrapping clearance for legend
    if (legendModel && legendModel.get('show') !== false) {
      // biome-ignore lint/suspicious/noExplicitAny: internal zrender bounding box retrieval
      const legendGroup = (chart as any).getViewOfComponentModel?.(legendModel)?.group;
      if (legendGroup) {
        const gridCoord = gridModel?.coordinateSystem;
        const gridRect = gridCoord?.getRect?.();
        const yAxisLeft = gridRect?.x ?? 0;
        const yAxisModel = model.getComponent('yAxis');
        const componentGap = Number(yAxisModel?.get('nameGap') ?? 0);
        const minLegendLeft = yAxisLeft > 0 ? yAxisLeft + componentGap : 0;

        const dataZoomModel = model.getComponent('dataZoom');
        const hasDataZoom = Boolean(dataZoomModel && dataZoomModel.get('show') !== false);

        const isToolboxDisabled = !toolboxModel || toolboxModel.get('show') === false;
        const toolboxItemSize = Number(toolboxModel?.get('itemSize') ?? 0);
        const toolboxItemGap = Number(toolboxModel?.get('itemGap') ?? 0);
        const toolboxRight = Number(toolboxModel?.get('right') ?? 0);
        const toolboxButtons = hasDataZoom ? 2 : 1;
        const toolboxWidth = toolboxRight + toolboxButtons * toolboxItemSize + (toolboxButtons - 1) * toolboxItemGap;
        const toolboxPaddingRight = isToolboxDisabled ? 0 : toolboxWidth + componentGap;

        const targetPadding = [0, toolboxPaddingRight, 0, minLegendLeft];

        const itemHeight = Number(legendModel.get('itemHeight') ?? 0);
        const legendHeight = legendGroup.getBoundingRect?.()?.height || itemHeight;

        // Expand top clearance for the grid only when legend wraps into multiple lines
        if (legendHeight > itemHeight) {
          outerTop = baseTop + (legendHeight - itemHeight);
        }

        const currentLegend = legendModel.option;
        const curPad = currentLegend?.padding;
        const curPadL = Array.isArray(curPad) ? curPad[3] : 0;
        const curPadR = Array.isArray(curPad) ? curPad[1] : 0;

        if (currentLegend?.left !== 'center' || currentLegend?.width !== undefined || currentLegend?.top !== baseTop || curPadL !== minLegendLeft || curPadR !== toolboxPaddingRight) {
          legendUpdate = {
            top: baseTop,
            left: 'center',
            width: undefined,
            padding: targetPadding,
          };
        }
      }
    }

    // 4. Resolve dynamic right clearance only for line charts with endLabels
    const seriesModels = model.getSeries?.();
    const shouldCheckEndLabel =
      hasEndLabel ??
      Boolean(
        seriesModels &&
          Array.isArray(seriesModels) &&
          // biome-ignore lint/suspicious/noExplicitAny: internal series model inspection
          seriesModels.some((s: any) => s?.subType === 'line' && s?.option?.endLabel && s.option.endLabel.show !== false),
      );

    const currentRight = typeof currentGrid?.right === 'number' ? currentGrid.right : 0;
    const gridWidth = gridModel?.coordinateSystem?.getRect?.()?.width;
    const dynamicRight = gridWidth && shouldCheckEndLabel ? computeDynamicEndLabelClearance(seriesModels, model.getComponent('xAxis')?.option, gridWidth) : undefined;

    const itemHeight = Number(legendModel?.get('itemHeight') ?? 12);
    // biome-ignore lint/suspicious/noExplicitAny: internal zrender bounding box retrieval
    const tbView = toolboxModel ? (chart as any).getViewOfComponentModel?.(toolboxModel) : null;
    const toolboxHeight = tbView?.group?.getBoundingRect?.()?.height || itemHeight;
    const targetToolboxTop = Math.round(baseTop + (itemHeight - toolboxHeight) / 2);

    const needsTopUpdate = currentGrid?.outerBounds?.top !== outerTop || toolboxModel?.option?.top !== targetToolboxTop;
    const needsRightUpdate = dynamicRight !== undefined && Math.abs(currentRight - dynamicRight) >= 1;

    // 5. Atomically apply layout updates only when coordinates have drifted
    if (currentGrid && (legendUpdate || needsTopUpdate || needsRightUpdate)) {
      const targetRight = needsRightUpdate ? dynamicRight : currentRight;
      chart.setOption({
        ...(legendUpdate ? { legend: legendUpdate } : {}),
        ...(needsTopUpdate || needsRightUpdate
          ? {
              grid: {
                top: 0,
                ...(needsRightUpdate ? { right: targetRight } : {}),
                outerBounds: {
                  top: outerTop,
                  ...(needsRightUpdate ? { right: targetRight } : {}),
                },
              },
              toolbox: { top: targetToolboxTop },
            }
          : {}),
      });
    }
  } catch {
    // Fail-safe silently falls back to standard theme defaults
  }
}

/** Resizes the ECharts canvas instance and synchronizes responsive grid offsets and label clearance. */
export function resizeChart(chart: ECharts | null | undefined): void {
  if (!chart || chart.isDisposed()) return;
  chart.resize();
  adjustChartLayout(chart);
}

/**
 * Applies enhanced ECharts options to the canvas instance with automatic two-pass layout adjustment.
 * Executes immediate layout pass followed by post-paint settling in requestAnimationFrame.
 */
export function renderChart(chart: ECharts | null | undefined, option: EChartsOption, onSettled?: () => void): void {
  if (!chart || chart.isDisposed()) return;
  chart.setOption(option, true);
  adjustChartLayout(chart);

  requestAnimationFrame(() => {
    if (chart.isDisposed()) return;
    adjustChartLayout(chart);
    onSettled?.();
  });
}

/** Registers standard event listeners on the ECharts canvas instance (e.g. view restore layout recalculation). */
export function bindChartEvents(chart: ECharts | null | undefined): void {
  if (!chart || chart.isDisposed()) return;
  chart.on('restore', () => adjustChartLayout(chart));
}

/* -------------------------------------------------------------------------- */
/* 3. Columnar Transposition & Stacked Bar Series Builders                    */
/* -------------------------------------------------------------------------- */

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
  const base = {
    type: 'bar' as const,
    ...(hideIfOverflowBar !== undefined ? { hideIfOverflowBar } : {}),
    ...(hideOverlap !== undefined ? { hideOverlap } : {}),
    ...series,
  };

  if (!formatLabel) {
    return { ...base, ...(label ? { label } : {}) } as BarSeriesOption & { data?: readonly T[] };
  }

  return {
    ...base,
    data: series.data as BarSeriesOption['data'],
    label: {
      show: true,
      position: label?.position ?? 'inside',
      distance: label?.distance ?? 5,
      ...label,
      formatter: (params: CallbackDataParams) => {
        const val = extractPointValue(params.data ?? params.value);
        return val ? (formatLabel({ value: val, index: params.dataIndex, item: (params.data ?? val) as T }) ?? '') : '';
      },
    },
  } as BarSeriesOption & { data?: readonly T[] };
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
    ...(hideOverlap !== undefined ? { hideOverlap } : {}),
    ...series,
    color,
    label: {
      show: true,
      position: label?.position ?? 'top',
      distance: label?.distance ?? 5,
      color,
      ...label,
      formatter: (params: CallbackDataParams) => {
        const tot = extractPointValue(params.data);
        return (tot && tot > 0 ? formatTotal({ total: tot, index: params.dataIndex, item: params.data as T }) : '') ?? '';
      },
    },
    data: rawData.map((item) => {
      const obj = typeof item === 'object' && item !== null ? item : { value: item };
      return { ...obj, originalValue: obj.value, value: 0 };
    }),
  };
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
  columns: TableColumnSpec[];
  /** Row generator callback producing formatted table rows. */
  rows: (ctx: TooltipTickContext<TData>) => TableRowSpec[];
  /** Optional summary footer generator callback. */
  footer?: (ctx: TooltipTickContext<TData>) => TableRowSpec | undefined;
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

/** Cohesive engine encapsulating all tooltip DOM rendering and formatting methods. */
const tooltipEngine = {
  renderDot: renderTooltipDot,
  renderHeader: (title: string, withBorder = false, size: 'xs' | 'sm' = 'xs', icon?: string) => renderTooltipHeader({ title, withBorder, size, icon }),
  renderRow: renderTooltipRow,
  renderFooter: renderTooltipFooter,

  resolveDualFooter<TData>(footer: DualTooltipFooter<TData> | undefined, ctx: DualTooltipFooterContext<TData>): TooltipFooterSpec | undefined {
    if (!footer) return undefined;
    if (typeof footer === 'function') return footer(ctx);
    if (ctx.posSum <= 0 || ctx.negSum <= 0) return undefined;
    const ratioStr = footer.format(ctx.posSum, ctx.negSum, footer.precision);
    return ratioStr ? { label: footer.label, value: ratioStr, color: footer.color ?? 'warning' } : undefined;
  },

  getColumnAlign: (align: TableColumnSpec['align'], colIdx: number) => (align === 'center' ? 'text-center' : align === 'right' || (!align && colIdx > 0) ? 'text-right' : 'text-left'),

  /** Normalizes polymorphic ECharts tooltip params and constructs the active tick context. */
  unwrapTick<TData>(params: unknown, headerFn?: (ctx: TooltipTickContext<TData>) => TooltipHeaderResult): { title: string; icon?: string; ctx: TooltipTickContext<TData> } | null {
    const items = (Array.isArray(params) ? params : [params]) as CallbackDataParams[];
    if (!items.length) return null;

    const first = items[0];
    const name = String(first?.name ?? '');

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
  },

  /** Renders a list of series rows with value extraction, formatting, sorting, and aggregation. */
  renderRows<TData>(
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
      const color = String(item.color ?? '#60a5fa');
      const seriesId = String(item.seriesId ?? '');
      const name = String(item.name ?? tickCtx.name);
      const data = (typeof item.data === 'object' && item.data !== null ? item.data : {}) as TData;

      if (rowFn) {
        const row = rowFn({ seriesName, value: num, color, seriesId, name, dataIndex: tickCtx.dataIndex, data });
        if (!row) continue;
        rowsHtml.push(this.renderRow(row, seriesName, color));
      } else if (valueFn && num > 0) {
        rowsHtml.push(this.renderRow({ value: valueFn(num) }, seriesName, color));
      } else {
        continue;
      }

      sum += num;
      count++;
    }

    return { html: rowsHtml.join(''), sum, count };
  },

  buildAxis<TData>(config: AxisTooltipSpec<TData>): (params: unknown) => string {
    return (params: unknown) => {
      const tick = this.unwrapTick<TData>(params, config.header);
      if (!tick) return '';

      const { html, sum, count } = this.renderRows(tick.ctx.items, tick.ctx, config.row, undefined, config.sort ?? 'desc');
      if (!count) return '';

      const footerHtml = this.renderFooter(config.footer?.({ ...tick.ctx, sum, count }));
      return `<div class="min-w-45">${this.renderHeader(tick.title, false, 'xs', tick.icon)}<div class="space-y-1">${html}</div>${footerHtml}</div>`;
    };
  },

  buildDual<TData>(config: DualTooltipSpec<TData>): (params: unknown) => string {
    return (params: unknown) => {
      const tick = this.unwrapTick<TData>(params, config.header);
      if (!tick) return '';

      const posItems: CallbackDataParams[] = [];
      const negItems: CallbackDataParams[] = [];
      for (const item of tick.ctx.items) {
        const num = Number(extractPointValue(item.data ?? item.value));
        if (num < 0 || String(item.seriesId).startsWith('imp')) negItems.push(item);
        else if (num > 0 || String(item.seriesId).startsWith('exp')) posItems.push(item);
      }

      const renderBranch = (group: DualGroupConfig<TData>, items: CallbackDataParams[]) => {
        const { html, sum } = this.renderRows(items, tick.ctx, config.row, config.formatValue, config.sort ?? 'desc', true);
        if (!html && !group.total) return { html: '', sum: 0 };
        const { className, styleAttr } = resolveColor(group.color);
        let totalText = '';
        if (typeof group.total === 'function') totalText = String(group.total({ ...tick.ctx, items, sum }));
        else if (group.total === true && config.formatValue && sum > 0) totalText = config.formatValue(sum);
        else if (group.total) totalText = String(group.total);

        const header = `<div class="font-bold text-[11px] uppercase tracking-wider flex justify-between mb-1 ${className}"${styleAttr}><span>${group.title}</span>${totalText ? `<span>${totalText}</span>` : ''}</div>`;
        return { html: `<div class="mb-2">${header}<div class="space-y-0.5">${html}</div></div>`, sum };
      };

      const pos = renderBranch(config.positive, posItems);
      const neg = renderBranch(config.negative, negItems);
      if (!pos.html && !neg.html) return '';

      const footer = this.resolveDualFooter(config.footer, { ...tick.ctx, posSum: pos.sum, negSum: neg.sum, posItems, negItems });
      return `<div class="min-w-50">${this.renderHeader(tick.title, false, 'xs', tick.icon)}${pos.html}${neg.html}${this.renderFooter(footer)}</div>`;
    };
  },

  buildTable<TData>(config: TableTooltipSpec<TData>): (params: unknown) => string {
    return (params: unknown) => {
      const tick = this.unwrapTick<TData>(params, config.header);
      if (!tick) return '';

      const rowSpecs = config.rows(tick.ctx);
      if (!rowSpecs.length) return '';

      const tableHtml = renderTooltipTableStructure({
        columns: config.columns,
        rows: rowSpecs,
        footer: config.footer?.(tick.ctx),
      });

      return `<div class="text-xs min-w-60 p-0.5">${this.renderHeader(tick.title, true, 'sm', tick.icon)}${tableHtml}</div>`;
    };
  },

  build<TData>(spec: ChartTooltipSpec<TData>): (params: unknown) => string {
    switch (spec.type) {
      case 'axis':
        return this.buildAxis(spec);
      case 'dual':
        return this.buildDual(spec);
      case 'table':
        return this.buildTable(spec);
    }
  },
};

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
        formatter: tooltipEngine.build(tooltipSpec),
        ...(tooltipSpec.axisPointer ? { axisPointer: tooltipSpec.axisPointer } : {}),
      };
    } else {
      resolvedTooltip = tooltipSpec;
    }
  }

  return {
    ...rest,
    ...(resolvedTooltip ? { tooltip: resolvedTooltip } : {}),
    series: series as unknown as EChartsOption['series'],
  };
}
