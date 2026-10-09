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
import { bindChartEvents, enhanceOption, renderChart, resizeChart } from '@/utils/chart-builder';
import { useTheme, useTranslation } from '@/utils/provider';
import { useInView } from '@/utils/useInView';

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

/**
 * Interactive ECharts canvas visualizer component handling lazy viewport initialization,
 * theme switching, reactive option updates, responsive resizing, and viewport-aware resize observer decoupling.
 */
export const SectionChart: React.FC<SectionChartProps> = ({ option: rawOption, exportName, id, className = 'w-full h-[60dvh]', offsetTop = 0, onReady }) => {
  const { t } = useTranslation();
  const { resolvedTheme, tokens } = useTheme();
  const option = enhanceOption(rawOption, t.common, exportName, tokens);

  const { ref: containerRef, hasEnteredView, isIntersecting } = useInView<HTMLDivElement>();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const optionRef = useRef(option);
  optionRef.current = option;
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const isIntersectingRef = useRef(isIntersecting);
  isIntersectingRef.current = isIntersecting;
  const needsResizeRef = useRef(false);
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  const [isRendered, setIsRendered] = useState(false);
  const hasNotifiedReady = useRef(false);

  const rawOptionRef = useRef(rawOption);
  rawOptionRef.current = rawOption;
  const rawOptionJsonRef = useRef<string>('');

  const notifyReady = useEffectEvent(() => {
    if (onReady && !hasNotifiedReady.current) {
      hasNotifiedReady.current = true;
      onReady();
    }
  });

  // Initialize ECharts instance on demand once the section enters the viewport proximity
  useEffect(() => {
    if (!hasEnteredView || !chartRef.current) return;

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
    rawOptionJsonRef.current = JSON.stringify(rawOptionRef.current);

    let resizeRaf: number | null = null;
    const handleLayout = () => {
      if (!chartRef.current) return;
      const r = chartRef.current.getBoundingClientRect();
      const hasSizeChanged = Math.abs(r.width - lastWidthRef.current) >= 1 || Math.abs(r.height - lastHeightRef.current) >= 1;
      if (!hasSizeChanged) return;

      // Pause layout calculations when chart is scrolled outside viewport
      if (!isIntersectingRef.current) {
        needsResizeRef.current = true;
        return;
      }

      lastWidthRef.current = r.width;
      lastHeightRef.current = r.height;

      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const currentChart = chartInstance.current;
        if (!currentChart || !chartRef.current) return;

        const newDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        if (newDpr !== dprRef.current) {
          dprRef.current = newDpr;
          currentChart.dispose();
          const nextChart = init(chartRef.current, resolvedThemeRef.current === 'dark' ? 'dark' : undefined, {
            renderer: 'canvas',
            devicePixelRatio: newDpr,
          });
          bindChartEvents(nextChart);
          chartInstance.current = nextChart;
          renderChart(nextChart, optionRef.current);
          return;
        }

        resizeChart(currentChart);
      });
    };

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

    // Render initial dataset
    renderChart(chart, optionRef.current, () => {
      setIsRendered(true);
      notifyReady();
    });

    return () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (cleanupMedia) cleanupMedia();
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
      setIsRendered(false);
    };
  }, [hasEnteredView, resolvedTheme]);

  // Reactively apply option updates to existing instance strictly when rawOption has mutated
  useEffect(() => {
    if (!chartInstance.current || !hasEnteredView) return;
    const optionJson = JSON.stringify(rawOption);
    if (rawOptionJsonRef.current === optionJson) return;
    rawOptionJsonRef.current = optionJson;

    renderChart(chartInstance.current, option, () => {
      setIsRendered(true);
      notifyReady();
    });
  }, [rawOption, option, hasEnteredView]);

  // Catch up with deferred resize operations once scrolled back into the active viewport
  useEffect(() => {
    if (isIntersecting && needsResizeRef.current && chartInstance.current && chartRef.current) {
      needsResizeRef.current = false;
      const r = chartRef.current.getBoundingClientRect();
      const hasSizeChanged = Math.abs(r.width - lastWidthRef.current) >= 1 || Math.abs(r.height - lastHeightRef.current) >= 1;
      if (hasSizeChanged) {
        lastWidthRef.current = r.width;
        lastHeightRef.current = r.height;
        const newDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        if (newDpr !== dprRef.current) {
          dprRef.current = newDpr;
          chartInstance.current.dispose();
          const nextChart = init(chartRef.current, resolvedTheme === 'dark' ? 'dark' : undefined, {
            renderer: 'canvas',
            devicePixelRatio: newDpr,
          });
          bindChartEvents(nextChart);
          chartInstance.current = nextChart;
          renderChart(nextChart, optionRef.current);
        } else {
          resizeChart(chartInstance.current);
        }
      }
    }
  }, [isIntersecting, resolvedTheme]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div ref={chartRef} id={id} className={className} style={offsetTop > 0 ? { marginTop: offsetTop } : undefined} />
      <LoadingSpinner isVisible={!isRendered} fullscreen={false} size="sm" />
    </div>
  );
};
