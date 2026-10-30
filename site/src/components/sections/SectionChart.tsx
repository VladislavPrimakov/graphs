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
import { createElement, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useSectionContext, useSectionResize } from '@/components/sections/Section';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { bindChartEvents, cancelQueuedChartRender, enhanceOption, exportChartAsPng, queueChartRender, resizeChart } from '@/utils/chart-builder';
import { cn } from '@/utils/cn';
import { useTheme, useTranslation } from '@/utils/provider';

/** Props for the ECharts canvas SectionChart visualizer component. */
export interface SectionChartProps {
  /** Native Apache ECharts option specification. */
  option: EChartsOption;
  /** Optional export filename override without file extension. Derived from SectionContext if omitted. */
  exportName?: string;
  /** Optional DOM element identifier for testing or scroll targeting. Derived from SectionContext if omitted. */
  id?: string;
  /** Optional container CSS class name. @default 'w-full h-chart' */
  className?: string;
  /** Optional section title override to draw atop exported PNG snapshots. Derived from SectionContext if omitted. */
  title?: string;
}

/** Creates an interactive SectionChart React element from an ECharts option. */
export function createChart(option: EChartsOption, className?: string): React.ReactElement {
  return createElement(SectionChart, { option, className });
}

/**
 * Interactive ECharts canvas visualizer component handling theme switching,
 * reactive option updates, and responsive container resizing with smooth cross-fade on initial render.
 */
export const SectionChart: React.FC<SectionChartProps> = ({ option: rawOption, exportName, id, className = 'w-full h-chart', title }) => {
  const sectionCtx = useSectionContext();
  const effectiveExportName = exportName ?? (sectionCtx ? `${sectionCtx.projectSlug}--${sectionCtx.sectionId}` : 'chart');
  const effectiveId = id ?? (sectionCtx ? `chart-${sectionCtx.sectionId}` : undefined);
  const effectiveTitle = title ?? sectionCtx?.title;

  const { t } = useTranslation();
  const { resolvedTheme, tokens } = useTheme();

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleExport = useEffectEvent(() => {
    if (chartInstance.current) {
      exportChartAsPng(chartInstance.current, effectiveTitle, effectiveExportName, tokens);
    }
  });

  // 1. Initialize ECharts instance on mount and observe container resizing
  // biome-ignore lint/correctness/useExhaustiveDependencies: theme updates are applied in-place via enhanceOption without disposing the canvas
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, resolvedTheme === 'dark' ? 'dark' : undefined, {
      renderer: 'canvas',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    });
    bindChartEvents(chart);
    chartInstance.current = chart;

    return () => {
      cancelQueuedChartRender(chart);
      chart.dispose();
      chartInstance.current = null;
      setIsReady(false);
    };
  }, []);

  useSectionResize(() => {
    if (chartInstance.current) {
      resizeChart(chartInstance.current);
    }
  });

  // 2. Reactively render enhanced option whenever rawOption, theme, or localization changes
  useEffect(() => {
    if (!chartInstance.current) return;
    const canvasWidth = chartInstance.current.getWidth?.() || chartRef.current?.clientWidth || 0;
    const enhanced = enhanceOption(rawOption, t.common, effectiveExportName, tokens, handleExport, canvasWidth);
    queueChartRender(chartInstance.current, enhanced, () => {
      setIsReady(true);
    });
    return () => {
      cancelQueuedChartRender(chartInstance.current);
    };
  }, [rawOption, effectiveExportName, tokens, t.common]);

  return (
    <div className="relative w-full min-w-0">
      <div ref={chartRef} id={effectiveId} className={cn('w-full min-w-0 max-w-full transition-opacity duration-300', isReady ? 'opacity-100' : 'opacity-0', className)} />
      <LoadingSpinner isVisible={!isReady} fullscreen={false} size="sm" />
    </div>
  );
};
