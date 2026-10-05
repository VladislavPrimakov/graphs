import type { ECharts, EChartsOption } from 'echarts';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  MarkLineComponent,
  LabelLayout,
  CanvasRenderer,
]);

const init = echarts.init;

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { themeFonts } from '@/styles/tokens';
import { enhanceOption } from '@/utils/chart-builder';
import { useTranslation } from '@/utils/locales';

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidthCache = new Map<string, number>();

function measureTextWidth(text: string, font = `bold 12px ${themeFonts.sansFamily}`): number {
  const cached = textWidthCache.get(text);
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
  textWidthCache.set(text, width);
  return width;
}

/**
 * Computes dynamic right clearance in pixels required to render line series end labels without canvas clipping.
 * Dynamically factors in the horizontal distance between the series last valid data point and the end of the X-axis.
 */
function computeEndLabelClearance(
  // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection
  seriesModels: any[],
  // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection
  xAxisOption: any,
  gridWidth: number,
): number {
  if (!seriesModels?.length) return 4;

  // Fast path: find series that actually have endLabel enabled (skips 95% of charts immediately)
  const endLabelSeries = seriesModels.filter((s) => s?.subType === 'line' && s?.option?.endLabel && s.option.endLabel.show !== false);
  if (!endLabelSeries.length) return 4;

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
    if (lastVal === undefined || lastIndex === -1) continue;

    const seriesName = typeof item.name === 'string' ? item.name : '';
    let text = '';
    if (typeof item.endLabel.formatter === 'function') {
      text = String(item.endLabel.formatter({ value: lastVal, seriesName, dataIndex: lastIndex }) ?? '');
    } else if (typeof item.endLabel.formatter === 'string') {
      text = item.endLabel.formatter.replace('{a}', seriesName).replace('{c}', String(lastVal));
    } else {
      text = seriesName ? `${seriesName}: ${lastVal}` : String(lastVal);
    }

    if (text) {
      const w = measureTextWidth(text);
      const distance = typeof item.endLabel.distance === 'number' ? item.endLabel.distance : 4;
      const totalLabelSpan = w + distance;

      // Compute distance from last valid data point to right edge of the grid
      const distToRight = tickStep > 0 ? (totalPoints - 1 - lastIndex + (isBoundaryGap ? 0.5 : 0)) * tickStep : 0;

      const overhang = totalLabelSpan - distToRight;
      if (overhang > maxOverhang) {
        maxOverhang = overhang;
      }
    }
  }

  return maxOverhang > 0 ? Math.ceil(maxOverhang) + 4 : 4;
}

/** Dynamically adjusts ECharts grid offsets (top for multi-line legends, right for endLabels) based on actual canvas dimensions. */
function adjustChartLayout(chart: ECharts, hasEndLabel = false): void {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection for dynamic layout calculations
    const model = (chart as any).getModel?.();
    if (!model) return;

    const titleModel = model.getComponent('title');
    const hasTitle = Boolean(titleModel && titleModel.get('show') !== false && titleModel.get('text'));
    // biome-ignore lint/suspicious/noExplicitAny: internal zrender bounding box retrieval
    const titleView = hasTitle ? (chart as any).getViewOfComponentModel?.(titleModel) : null;
    const titleHeight = hasTitle ? Math.round(titleView?.group?.getBoundingRect?.()?.height || 28) : 0;
    const headerClearance = Math.max(titleHeight, 28);

    const legendModel = model.getComponent('legend');
    const isLegendDisabled = !legendModel || legendModel.get('show') === false;
    const legendItemGap = legendModel ? (legendModel.get('itemGap') ?? 0) : 0;
    const yAxisModel = model.getComponent('yAxis');
    const layoutGap = legendItemGap > 0 ? legendItemGap : (yAxisModel?.get('nameGap') ?? 6);
    const legendTop = headerClearance + layoutGap;

    const gridCoord = model.getComponent('grid')?.coordinateSystem;
    const gridRect = gridCoord?.getRect?.();
    const yAxisLeft = gridRect?.x ?? 0;
    const gridWidth = gridRect?.width;

    let outerTop = legendTop;
    let legendUpdate: Record<string, unknown> | null = null;

    if (!isLegendDisabled) {
      // biome-ignore lint/suspicious/noExplicitAny: internal zrender bounding box retrieval
      const legendGroup = (chart as any).getViewOfComponentModel?.(legendModel)?.group;
      if (legendGroup) {
        const minLegendLeft = yAxisLeft > 0 ? yAxisLeft + layoutGap : 0;

        const dataZoomModel = model.getComponent('dataZoom');
        const hasDataZoom = Boolean(dataZoomModel && dataZoomModel.get('show') !== false);

        const toolboxModel = model.getComponent('toolbox');
        const isToolboxDisabled = !toolboxModel || toolboxModel.get('show') === false;
        const toolboxItemSize = toolboxModel ? (toolboxModel.get('itemSize') ?? 12) : 12;
        const toolboxItemGap = toolboxModel ? (toolboxModel.get('itemGap') ?? 2) : 2;
        const toolboxPaddingRight = isToolboxDisabled ? 0 : (toolboxItemSize + toolboxItemGap) * (hasDataZoom ? 2 : 1);

        const chartWidth = chart.getWidth();
        const legendWidth = legendGroup.getBoundingRect?.()?.width || 0;
        const centerLeft = (chartWidth - legendWidth) / 2;

        const legendItemHeight = legendModel.get('itemHeight') ?? legendModel.get('textStyle.fontSize') ?? 12;
        const legendHeight = legendGroup.getBoundingRect?.()?.height || legendItemHeight;
        const rightClearance = chartWidth - toolboxPaddingRight;
        const shouldConstrainLeft = minLegendLeft > 0 && (centerLeft < minLegendLeft || centerLeft + legendWidth > rightClearance);

        const targetLegendLeft = shouldConstrainLeft ? minLegendLeft : 'center';
        const targetLegendWidth = shouldConstrainLeft ? Math.max(0, chartWidth - minLegendLeft - toolboxPaddingRight) : undefined;
        const targetPadding = shouldConstrainLeft ? 0 : [0, toolboxPaddingRight, 0, 0];

        outerTop = legendTop + Math.max(0, legendHeight - legendItemHeight);

        const currentLegend = legendModel.option;
        if (currentLegend?.left !== targetLegendLeft || currentLegend?.width !== targetLegendWidth || currentLegend?.top !== legendTop) {
          legendUpdate = {
            top: legendTop,
            left: targetLegendLeft,
            width: targetLegendWidth,
            padding: targetPadding,
          };
        }
      }
    }

    const gridModel = model.getComponent('grid');
    const currentGrid = gridModel?.option;
    const toolboxModel = model.getComponent('toolbox');
    const currentToolbox = toolboxModel?.option;
    const currentOuterTop = currentGrid?.outerBounds?.top;

    // Dynamically calculate exact right clearance only when chart has active endLabels
    const dynamicRight = gridWidth && hasEndLabel ? computeEndLabelClearance(model.getSeries(), model.getComponent('xAxis')?.option, gridWidth) : undefined;
    const currentRight = typeof currentGrid?.right === 'number' ? currentGrid.right : 4;
    const needsRightUpdate = dynamicRight !== undefined && Math.abs(currentRight - dynamicRight) > 2;

    const needsLayoutUpdate = currentGrid && (currentOuterTop !== outerTop || currentToolbox?.top !== outerTop || needsRightUpdate);
    if (legendUpdate || needsLayoutUpdate) {
      const targetRight = needsRightUpdate ? dynamicRight : currentRight;
      chart.setOption({
        ...(legendUpdate ? { legend: legendUpdate } : {}),
        ...(needsLayoutUpdate
          ? {
              grid: {
                top: 0,
                ...(needsRightUpdate ? { right: targetRight } : {}),
                outerBounds: {
                  top: outerTop,
                  ...(needsRightUpdate ? { right: targetRight } : {}),
                },
              },
              toolbox: { top: outerTop },
            }
          : {}),
      });
    }
  } catch {
    // Fail-safe silently falls back to standard theme defaults
  }
}

/** Props for the ECharts canvas SectionChart visualizer component. */
export interface SectionChartProps {
  /** Native Apache ECharts option specification. */
  option: EChartsOption;
  /** Export filename without file extension. */
  exportName: string;
  /** Optional DOM element identifier for testing or scroll targeting. */
  id?: string;
  /** Optional container CSS class name. @default 'w-full h-[60dvh]' */
  className?: string;
  /** Vertical top offset in pixels applied to the canvas HTML container to clear overlapping card controls. @default 0 */
  offsetTop?: number;
  /** Callback fired once the chart completes its initial canvas render. */
  onReady?: () => void;
}

/** Interactive ECharts canvas visualizer component handling canvas initialization, reactive option updates, and responsive resizing. */
export const SectionChart: React.FC<SectionChartProps> = ({ option: rawOption, exportName, id, className = 'w-full h-[60dvh]', offsetTop = 0, onReady }) => {
  const { t } = useTranslation();
  const option = enhanceOption(rawOption, t.common, exportName);

  const seriesList = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic ECharts series inspection
  const hasEndLabel = seriesList.some((s) => s && typeof s === 'object' && (s as any).type === 'line' && (s as any).endLabel?.show !== false && (s as any).endLabel != null);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const hasEndLabelRef = useRef(hasEndLabel);
  hasEndLabelRef.current = hasEndLabel;
  const optionRef = useRef(option);
  optionRef.current = option;
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const [isRendered, setIsRendered] = useState(false);
  const hasNotifiedReady = useRef(false);

  // Initialize ECharts instance on mount and coordinate responsive layout
  useEffect(() => {
    if (!chartRef.current) return;

    const initialDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    dprRef.current = initialDpr;
    const chart = init(chartRef.current, 'dark', {
      renderer: 'canvas',
      devicePixelRatio: initialDpr,
    });
    chartInstance.current = chart;

    let resizeRaf: number | null = null;
    const handleLayout = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const currentChart = chartInstance.current;
        if (!currentChart || !chartRef.current) return;

        const newDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        if (newDpr !== dprRef.current) {
          dprRef.current = newDpr;
          currentChart.dispose();
          const nextChart = init(chartRef.current, 'dark', {
            renderer: 'canvas',
            devicePixelRatio: newDpr,
          });
          chartInstance.current = nextChart;
          nextChart.on('restore', () => adjustChartLayout(nextChart, hasEndLabelRef.current));
          nextChart.setOption(optionRef.current, true);
          adjustChartLayout(nextChart, hasEndLabelRef.current);
          return;
        }

        currentChart.resize();
        adjustChartLayout(currentChart, hasEndLabelRef.current);
      });
    };

    chart.on('restore', () => adjustChartLayout(chart, hasEndLabelRef.current));

    const resizeObserver = new ResizeObserver(handleLayout);
    resizeObserver.observe(chartRef.current);

    let cleanupMedia: (() => void) | null = null;
    const watchDpr = () => {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onDprChange = () => {
        handleLayout();
        watchDpr();
      };
      media.addEventListener('change', onDprChange, { once: true });
      cleanupMedia = () => media.removeEventListener('change', onDprChange);
    };
    watchDpr();

    return () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (cleanupMedia) cleanupMedia();
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // Reactively apply option updates to existing instance with full state synchronization
  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption(option, true);
    adjustChartLayout(chartInstance.current, hasEndLabel);

    requestAnimationFrame(() => {
      setIsRendered(true);
      if (onReady && !hasNotifiedReady.current) {
        hasNotifiedReady.current = true;
        onReady();
      }
    });
  }, [option, hasEndLabel, onReady]);

  return (
    <div className="relative w-full">
      <div ref={chartRef} id={id} className={className} style={offsetTop > 0 ? { marginTop: offsetTop } : undefined} />
      <LoadingSpinner isVisible={!isRendered} fullscreen={false} size="sm" />
    </div>
  );
};
