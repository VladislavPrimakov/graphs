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
import { enhanceOption } from '@/utils/chart-builder';
import { useTranslation } from '@/utils/locales';

/** Dynamically adjusts ECharts grid top offset to accommodate multi-line wrapped legends, titles, and card controls without clipping. */
function adjustLayoutForLegend(chart: ECharts, controlsHeight = 0): void {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: ECharts internal model inspection for dynamic layout calculations
    const model = (chart as any).getModel?.();
    if (!model) return;

    const titleModel = model.getComponent('title');
    const hasTitle = Boolean(titleModel && titleModel.get('show') !== false && titleModel.get('text'));
    const hasSubtext = Boolean(hasTitle && titleModel?.get('subtext'));
    const titleHeight = hasSubtext ? 42 : hasTitle ? 26 : 0;
    const headerClearance = Math.max(titleHeight, controlsHeight);

    const legendModel = model.getComponent('legend');
    const isLegendDisabled = !legendModel || legendModel.get('show') === false;

    if (isLegendDisabled) {
      if (headerClearance > 0) {
        const outerTop = headerClearance + 12;
        const currentOption = chart.getOption() as EChartsOption;
        const currentGrid = Array.isArray(currentOption.grid) ? currentOption.grid[0] : currentOption.grid;
        // biome-ignore lint/suspicious/noExplicitAny: outerBounds is ECharts v6 layout property
        const currentOuterTop = (currentGrid?.outerBounds as any)?.top;
        if (currentGrid && currentOuterTop !== outerTop) {
          chart.setOption({
            grid: { top: 0, outerBounds: { top: outerTop } },
            toolbox: { top: outerTop },
          });
        }
      }
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: internal zrender bounding box retrieval
    const legendView = (chart as any).getViewOfComponentModel?.(legendModel);
    const legendGroup = legendView?.group;
    if (!legendGroup) return;

    const legendHeight = legendGroup.getBoundingRect?.()?.height || 24;
    const legendTop = headerClearance > 0 ? headerClearance + 12 : 0;
    const outerTop = legendTop + legendHeight + 12;

    const currentOption = chart.getOption() as EChartsOption;
    const currentGrid = Array.isArray(currentOption.grid) ? currentOption.grid[0] : currentOption.grid;
    const currentLegend = Array.isArray(currentOption.legend) ? currentOption.legend[0] : currentOption.legend;
    // biome-ignore lint/suspicious/noExplicitAny: outerBounds is ECharts v6 layout property
    const currentOuterTop = (currentGrid?.outerBounds as any)?.top;

    if (currentGrid && (currentOuterTop !== outerTop || currentLegend?.top !== legendTop)) {
      chart.setOption({
        legend: { top: legendTop },
        grid: { top: 0, outerBounds: { top: outerTop } },
        toolbox: { top: outerTop },
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
  /** Height in pixels occupied by card controls in desktop view. @default 0 */
  controlsHeight?: number;
  /** Callback fired once the chart completes its initial canvas render. */
  onReady?: () => void;
}

/** Interactive ECharts canvas visualizer component handling canvas initialization, reactive option updates, and responsive resizing. */
export const SectionChart: React.FC<SectionChartProps> = ({ option: rawOption, exportName, id, className = 'w-full h-[60dvh]', controlsHeight = 0, onReady }) => {
  const { t } = useTranslation();
  const option = enhanceOption(rawOption, t.common, exportName, controlsHeight);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const hasNotifiedReady = useRef(false);

  // Initialize ECharts instance on mount and coordinate responsive layout
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, 'dark', {
      renderer: 'canvas',
    });
    chartInstance.current = chart;

    const handleResize = () => {
      chart.resize();
      adjustLayoutForLegend(chart, controlsHeight);
    };

    const handleRestore = () => {
      adjustLayoutForLegend(chart, controlsHeight);
    };

    chart.on('restore', handleRestore);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      chart.off('restore', handleRestore);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [controlsHeight]);

  // Reactively apply option updates to existing instance with full state synchronization
  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption(option, true);
    adjustLayoutForLegend(chartInstance.current, controlsHeight);

    requestAnimationFrame(() => {
      setIsRendered(true);
      if (onReady && !hasNotifiedReady.current) {
        hasNotifiedReady.current = true;
        onReady();
      }
    });
  }, [option, controlsHeight, onReady]);

  return (
    <div className="relative w-full">
      <div ref={chartRef} id={id} className={className} />
      <LoadingSpinner isVisible={!isRendered} fullscreen={false} size="sm" />
    </div>
  );
};
