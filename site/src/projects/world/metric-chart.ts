import type { WorldMetricSectionData } from '@graphs/types/world/metric';
import type { LineSeriesOption } from 'echarts';
import { type BuildSectionContext, chartSection, type DashboardSection, type ProjectSource } from '@/types';
import { chartOption } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';

interface WorldMetricConfig {
  id: string;
  title: string;
  unit: string;
  sources?: ProjectSource[];
}

/** Shared builder for world economic and energy line chart sections. */
export const createWorldMetricSection = ({ t, fmt }: BuildSectionContext<typeof dict>, config: WorldMetricConfig): DashboardSection<WorldMetricSectionData> => {
  const formatValue = (val: number) => fmt.number(val, val >= 100 ? { maximumFractionDigits: 0 } : undefined);

  return chartSection({
    id: config.id,
    title: config.title,
    sources: config.sources,
    controls: (data) =>
      [
        {
          id: 'topN',
          type: 'slider',
          min: 3,
          max: Math.min(15, Object.keys(data.series).length || 15),
          defaultValue: 7,
          label: t.common.top,
        },
        {
          id: 'years',
          type: 'range-slider',
          min: data.years[0],
          max: data.years[data.years.length - 1],
          defaultValue: [Math.max(data.years[0], 2000), data.years[data.years.length - 1]],
          label: t.common.period,
        },
      ] as const,
    buildView: (data, values) => {
      const { years, series: chartSeries } = data;
      const yearsStr = years.map(String);
      const topN = values.topN;
      const [startYear, endYear] = values.years;
      const startIdx = Math.max(0, years.indexOf(startYear));
      const endIdx = years.indexOf(endYear) !== -1 ? years.indexOf(endYear) + 1 : years.length;
      const targetIdx = endIdx - 1;

      const visibleYears = yearsStr.slice(startIdx, endIdx);

      const getRankingValue = (seriesValues: (number | null)[]): number => {
        for (let i = targetIdx; i >= startIdx; i--) {
          const val = seriesValues[i];
          if (val != null && !Number.isNaN(val)) return val;
        }
        return 0;
      };

      const activeCodes = Object.keys(chartSeries)
        .sort((a, b) => getRankingValue(chartSeries[b]) - getRankingValue(chartSeries[a]))
        .slice(0, topN);

      const series = activeCodes
        .filter((entityCode) => chartSeries[entityCode] != null)
        .map((entityCode): LineSeriesOption => {
          const values = chartSeries[entityCode];
          const regionCode = entityCode;
          const name = fmt.region(regionCode);
          const color = fmt.regionColor(regionCode);

          return {
            id: entityCode,
            name,
            type: 'line',
            color,
            data: values.slice(startIdx, endIdx),
            endLabel: {
              show: true,
              formatter: ({ value, seriesName }) => (typeof value === 'number' ? `${seriesName}: ${formatValue(value)}` : ''),
            },
            labelLayout: {
              moveOverlap: 'shiftY',
            },
          };
        });

      return chartOption({
        title: { text: `${config.title} (${t.common.top} ${topN})` },
        legend: { show: false },
        tooltip: {
          type: 'axis',
          sort: 'desc',
          row: ({ value }) => ({
            value: formatValue(value),
          }),
        },
        xAxis: {
          type: 'category',
          data: visibleYears,
        },
        yAxis: {
          type: 'value',
          name: config.unit,
        },
        series,
      });
    },
  });
};
