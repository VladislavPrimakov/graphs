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
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ResolvedTheme } from '@/styles/tokens';
import { bindChartEvents, enhanceOption, exportChartAsPng, renderChart, resizeChart } from '@/utils/chart-builder';
import { cn } from '@/utils/cn';
import { useTheme, useTranslation } from '@/utils/provider';

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
  /** Callback fired once the chart completes its initial canvas render. */
  onReady?: () => void;
  /** Section title to draw atop exported PNG snapshots. */
  title?: string;
}

/**
 * Interactive ECharts canvas visualizer component handling theme switching,
 * reactive option updates, responsive resizing, and viewport-aware resize observer decoupling.
 */
export const SectionChart: React.FC<SectionChartProps> = ({ option: rawOption, exportName, id, className = 'w-full h-[60dvh]', onReady, title }) => {
  const { t } = useTranslation();
  const { resolvedTheme, tokens } = useTheme();

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const isIntersectingRef = useRef(true);
  const needsResizeRef = useRef(false);
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  const [isRendered, setIsRendered] = useState(false);
  const hasNotifiedReady = useRef(false);

  const lastRenderedRawOptionRef = useRef<EChartsOption | null>(null);
  const lastRenderedThemeRef = useRef<ResolvedTheme | null>(null);

  const notifyReady = useEffectEvent(() => {
    if (onReady && !hasNotifiedReady.current) {
      hasNotifiedReady.current = true;
      onReady();
    }
  });

  const handleExport = useEffectEvent(() => {
    if (chartInstance.current) {
      exportChartAsPng(chartInstance.current, title, exportName, tokens);
    }
  });

  const renderCurrentChart = useEffectEvent((targetChart: ECharts) => {
    lastRenderedRawOptionRef.current = rawOption;
    lastRenderedThemeRef.current = resolvedTheme;
    const enhanced = enhanceOption(rawOption, t.common, exportName, tokens, handleExport);
    renderChart(targetChart, enhanced, () => {
      setIsRendered(true);
      notifyReady();
    });
  });

  // 1. Initialize ECharts instance and setup observers (ResizeObserver & IntersectionObserver)
  useEffect(() => {
    if (!chartRef.current) return;

    const initialDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    dprRef.current = initialDpr;
    const chart = init(chartRef.current, resolvedTheme === 'dark' ? 'dark' : undefined, {
      renderer: 'canvas',
      devicePixelRatio: initialDpr,
    });
    bindChartEvents(chart);
    chartInstance.current = chart;

    const rect = chartRef.current.getBoundingClientRect();
    lastWidthRef.current = rect.width;
    lastHeightRef.current = rect.height;

    let resizeRaf: number | null = null;
    const handleLayout = (entries?: ResizeObserverEntry[]) => {
      if (!chartRef.current) return;
      let newWidth = lastWidthRef.current;
      let newHeight = lastHeightRef.current;

      const entry = entries?.[0];
      if (entry) {
        newWidth = entry.contentRect.width;
        newHeight = entry.contentRect.height;
      } else {
        const r = chartRef.current.getBoundingClientRect();
        newWidth = r.width;
        newHeight = r.height;
      }

      const hasSizeChanged = Math.abs(newWidth - lastWidthRef.current) >= 1 || Math.abs(newHeight - lastHeightRef.current) >= 1;
      if (!hasSizeChanged) return;

      // Pause layout calculations when chart is scrolled outside viewport
      if (!isIntersectingRef.current) {
        needsResizeRef.current = true;
        return;
      }

      lastWidthRef.current = newWidth;
      lastHeightRef.current = newHeight;

      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const currentChart = chartInstance.current;
        if (!currentChart || !chartRef.current) return;

        const newDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        if (newDpr !== dprRef.current) {
          dprRef.current = newDpr;
          currentChart.dispose();
          const nextChart = init(chartRef.current, resolvedTheme === 'dark' ? 'dark' : undefined, {
            renderer: 'canvas',
            devicePixelRatio: newDpr,
          });
          bindChartEvents(nextChart);
          chartInstance.current = nextChart;
          renderCurrentChart(nextChart);
          return;
        }

        resizeChart(currentChart);
      });
    };

    const resizeObserver = new ResizeObserver(handleLayout);
    resizeObserver.observe(chartRef.current);

    // Track intersection purely in ref without causing React re-renders on scroll
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      isIntersectingRef.current = entry.isIntersecting;
      if (entry.isIntersecting && needsResizeRef.current && chartInstance.current) {
        needsResizeRef.current = false;
        const r = chartRef.current?.getBoundingClientRect();
        if (r && (Math.abs(r.width - lastWidthRef.current) >= 1 || Math.abs(r.height - lastHeightRef.current) >= 1)) {
          lastWidthRef.current = r.width;
          lastHeightRef.current = r.height;
          resizeChart(chartInstance.current);
        }
      }
    });
    intersectionObserver.observe(chartRef.current);

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

    // Render chart immediately upon instance creation
    renderCurrentChart(chart);

    return () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (cleanupMedia) cleanupMedia();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
      lastRenderedRawOptionRef.current = null;
      lastRenderedThemeRef.current = null;
      setIsRendered(false);
    };
  }, [resolvedTheme]);

  // 2. Reactively apply option updates strictly when rawOption or theme changes
  useEffect(() => {
    if (!chartInstance.current) return;
    if (lastRenderedRawOptionRef.current === rawOption && lastRenderedThemeRef.current === resolvedTheme) {
      return;
    }
    renderCurrentChart(chartInstance.current);
  }, [rawOption, resolvedTheme]);

  return (
    <div className="relative w-full min-w-0 overflow-hidden">
      <div ref={chartRef} id={id} className={cn('w-full min-w-0 max-w-full', className)} />
      <LoadingSpinner isVisible={!isRendered} fullscreen={false} size="sm" />
    </div>
  );
};
