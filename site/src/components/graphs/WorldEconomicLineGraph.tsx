import type React from 'react';
import type { CallbackDataParams, EChartsOption, LineSeriesOption, WorldChartMetricData, WorldEntityInfo } from '@/types';
import { getCountryColor } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the generic macroeconomic multi-line comparative chart. */
export interface WorldEconomicLineGraphProps {
  /** Chart heading text displayed at the top of the canvas. */
  title: string;
  /** Subtitle detailing metric definition and scope. */
  subtitle?: string;
  /** Unique HTML element id attribute for chart targeting. */
  chartId?: string;
  /** 4-digit calendar years array. */
  years: number[];
  /** Entity metadata map keyed by country/region code. */
  entities: Record<string, WorldEntityInfo>;
  /** Time-series dataset for this metric. */
  data: WorldChartMetricData;
}

/** Multi-line chart comparing macroeconomic and physical industrial metrics across major global economies. */
export const WorldEconomicLineGraph: React.FC<WorldEconomicLineGraphProps> = ({ title, subtitle, chartId, years, entities, data }) => {
  const latestYearStr = String(years[years.length - 1]);

  const series: LineSeriesOption[] = Object.entries(data.series).map(([entityCode, values]) => {
    const ent = entities[entityCode];
    const seriesName = ent?.name || entityCode;
    const color = getCountryColor(seriesName);

    return {
      name: seriesName,
      type: 'line',
      data: values,
      smooth: false,
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2.0 },
      itemStyle: { color },
      endLabel: {
        show: true,
        formatter: (params: CallbackDataParams) => {
          const val = params.value;
          if (val === null || val === undefined || (typeof val === 'number' && Number.isNaN(val))) return '';
          const numVal = Number(val);
          const formatted = !Number.isNaN(numVal) ? (numVal >= 100 ? Math.round(numVal).toLocaleString() : numVal % 1 === 0 ? numVal : numVal.toFixed(1)) : String(val);
          const yrTag = params.name && params.name !== latestYearStr ? ` (${params.name})` : '';
          return `${params.seriesName}${yrTag}: ${formatted}`;
        },
        color: 'inherit',
        fontSize: 12,
        fontWeight: 'bold',
        distance: 8,
        valueAnimation: false,
      },
      labelLayout: {
        moveOverlap: 'shiftY',
      },
    };
  });

  const option: EChartsOption = {
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const year = items[0]?.name;
        let res = createTooltipHeader(year);
        res += '<div class="space-y-1">';
        const sorted = [...items].sort((a, b) => (Number(b?.value) || 0) - (Number(a?.value) || 0));
        sorted.forEach((item) => {
          if (item?.value !== null && item?.value !== undefined) {
            res += createTooltipRow(String(item.seriesName), Number(item.value), { dotColor: String(item.color) });
          }
        });
        res += '</div>';
        return res;
      },
    },
    grid: {
      top: 100,
      left: '3%',
      right: '9%',
      bottom: '6%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
    },
    yAxis: {
      type: 'value',
      name: data.unit,
    },
    series,
  };

  return (
    <section data-anchor-section={chartId} className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId={chartId}>
        <EChart option={option} height="480px" chartId={chartId ? `echart-${chartId}` : undefined} />
      </ChartCard>
    </section>
  );
};

export default WorldEconomicLineGraph;
