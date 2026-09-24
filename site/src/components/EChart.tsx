import * as echarts from 'echarts';
import type React from 'react';
import { useEffect, useRef } from 'react';
import type { EChartsOption, GridComponentOption, LegendComponentOption, TitleComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption } from '@/types';
import { CHART_BASE_THEME, themeColors } from '../styles/tokens';

/** Props for the interactive ECharts canvas wrapper component. */
export interface EChartProps {
  /** Complete Apache ECharts configuration option object. */
  option: EChartsOption;
  /** Explicit container CSS height value with units (e.g. '480px', '100%'). @default '480px' */
  height?: string;
  /** Optional additional CSS class names applied to the chart root container. @default '' */
  className?: string;
  /** HTML element id attribute for DOM selection or test targeting. */
  chartId?: string;
  /** Callback fired immediately after chart instantiation to provide direct instance access. */
  onInit?: (chart: echarts.ECharts) => void;
}

function mergeSingleXAxis(axis?: XAXisComponentOption): XAXisComponentOption {
  const base = CHART_BASE_THEME.xAxis;
  if (!axis) return base;
  return {
    ...base,
    ...axis,
    axisLabel: { ...base.axisLabel, ...axis.axisLabel },
    axisLine: { ...base.axisLine, ...axis.axisLine },
  };
}

function mergeSingleYAxis(axis?: YAXisComponentOption): YAXisComponentOption {
  const base = CHART_BASE_THEME.yAxis;
  if (!axis) return base;
  return {
    ...base,
    ...axis,
    nameTextStyle: { ...base.nameTextStyle, ...axis.nameTextStyle },
    splitLine: { ...base.splitLine, ...axis.splitLine },
    axisLabel: { ...base.axisLabel, ...axis.axisLabel },
  };
}

function mergeXAxis(xAxis: EChartsOption['xAxis']): EChartsOption['xAxis'] {
  if (!xAxis) return CHART_BASE_THEME.xAxis;
  if (Array.isArray(xAxis)) {
    return xAxis.map(mergeSingleXAxis);
  }
  return mergeSingleXAxis(xAxis);
}

function mergeYAxis(yAxis: EChartsOption['yAxis']): EChartsOption['yAxis'] {
  if (!yAxis) return CHART_BASE_THEME.yAxis;
  if (Array.isArray(yAxis)) {
    return yAxis.map(mergeSingleYAxis);
  }
  return mergeSingleYAxis(yAxis);
}

function mergeDataZoom(dataZoom: EChartsOption['dataZoom']): EChartsOption['dataZoom'] {
  if (!dataZoom) return undefined;
  if (Array.isArray(dataZoom)) {
    return dataZoom.map((dz) => {
      if (typeof dz === 'object' && dz !== null && 'type' in dz && dz.type === 'slider') {
        return { ...CHART_BASE_THEME.dataZoom, ...dz };
      }
      return dz;
    });
  }
  if (typeof dataZoom === 'object' && dataZoom !== null && 'type' in dataZoom && dataZoom.type === 'slider') {
    return { ...CHART_BASE_THEME.dataZoom, ...dataZoom };
  }
  return dataZoom;
}

function mergeTitle(title: EChartsOption['title']): TitleComponentOption | undefined {
  if (!title) return undefined;
  const optTitle = Array.isArray(title) ? title[0] : title;
  if (!optTitle) return undefined;
  return {
    ...CHART_BASE_THEME.title,
    ...optTitle,
    textStyle: { ...CHART_BASE_THEME.title.textStyle, ...optTitle.textStyle },
    subtextStyle: { ...CHART_BASE_THEME.title.subtextStyle, ...optTitle.subtextStyle },
  };
}

function mergeLegend(legend: EChartsOption['legend']): LegendComponentOption | undefined {
  if (!legend) return undefined;
  const optLegend = Array.isArray(legend) ? legend[0] : legend;
  if (!optLegend) return undefined;
  return {
    ...CHART_BASE_THEME.legend,
    ...optLegend,
    textStyle: { ...CHART_BASE_THEME.legend.textStyle, ...optLegend.textStyle },
  };
}

function mergeGrid(grid: EChartsOption['grid']): GridComponentOption {
  if (!grid) return CHART_BASE_THEME.grid;
  const optGrid = Array.isArray(grid) ? grid[0] : grid;
  return {
    ...CHART_BASE_THEME.grid,
    ...optGrid,
  };
}

function mergeTooltip(tooltip: EChartsOption['tooltip']): TooltipComponentOption | undefined {
  if (!tooltip) return undefined;
  const optTooltip = Array.isArray(tooltip) ? tooltip[0] : tooltip;
  if (typeof optTooltip !== 'object' || optTooltip === null) return optTooltip;
  return {
    ...CHART_BASE_THEME.tooltip,
    ...optTooltip,
    textStyle: {
      ...CHART_BASE_THEME.tooltip.textStyle,
      ...optTooltip.textStyle,
    },
  };
}

/** Merges user-specified chart options with default dark theme design tokens, font styling, and toolbox export features. */
export function enhanceOption(option: EChartsOption): EChartsOption {
  if (!option) return option;
  const optToolbox = Array.isArray(option.toolbox) ? option.toolbox[0] : option.toolbox;

  return {
    backgroundColor: 'transparent',
    ...option,
    textStyle: {
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      ...option.textStyle,
    },
    title: mergeTitle(option.title),
    legend: mergeLegend(option.legend),
    grid: mergeGrid(option.grid),
    xAxis: mergeXAxis(option.xAxis),
    yAxis: mergeYAxis(option.yAxis),
    dataZoom: mergeDataZoom(option.dataZoom),
    tooltip: mergeTooltip(option.tooltip),
    toolbox: {
      show: true,
      right: '2%',
      top: '2%',
      iconStyle: {
        borderColor: themeColors.text.muted,
      },
      emphasis: {
        iconStyle: {
          borderColor: themeColors.accent.primary,
        },
      },
      feature: {
        dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
        restore: { title: 'Restore' },
        saveAsImage: {
          pixelRatio: 2,
          title: 'Export PNG',
          type: 'png',
          backgroundColor: themeColors.surface.card,
        },
        ...optToolbox?.feature,
      },
      ...optToolbox,
    },
  };
}

/** Interactive Canvas chart wrapper that manages initialization, option updates, and responsive viewport resizing. */
export const EChart: React.FC<EChartProps> = ({ option, height = '480px', className = '', chartId, onInit }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark', {
        renderer: 'canvas',
      });
      if (onInit) {
        onInit(chartInstance.current);
      }
    }

    const enhanced = enhanceOption(option);
    chartInstance.current.setOption(enhanced, true);

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    const handleWindowResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [option, onInit]);

  return <div ref={chartRef} id={chartId} className={`w-full ${className}`} style={{ height }} />;
};

export default EChart;
