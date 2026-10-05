import type { LineSeriesOption } from 'echarts';
import { type BuildSectionsContext, type ChartSection, chartSection } from '@/types';
import { chartOption } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';

interface WorldMetricConfig {
  id: string;
  title: string;
  chartData: { series: Record<string, (number | null)[]> };
  unit: string;
}

/** Shared builder for world economic and energy line chart sections. */
export const createWorldMetricSection = ({ data, t, fmt }: BuildSectionsContext<'world', typeof dict>, config: WorldMetricConfig): ChartSection => {
  const { years } = data;
  const yearsStr = years.map(String);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const formatValue = (val: number) => fmt.number(val, val >= 100 ? { maximumFractionDigits: 0 } : undefined);
  const totalEntities = Object.keys(config.chartData.series).length;

  return chartSection({
    id: config.id,
    title: config.title,
    controls: [
      {
        id: 'topN',
        type: 'slider',
        min: Math.min(3, totalEntities),
        max: Math.min(15, totalEntities),
        defaultValue: Math.min(7, totalEntities),
        label: t.common.top,
      },
      {
        id: 'years',
        type: 'range-slider',
        min: minYear,
        max: maxYear,
        label: t.common.period,
      },
    ],
    buildView: (values) => {
      const topN = values.topN;
      const [startYear, endYear] = values.years;
      const startIdx = years.indexOf(startYear);
      const endIdx = years.indexOf(endYear) + 1;
      const targetIdx = endIdx - 1;

      const visibleYears = yearsStr.slice(startIdx, endIdx);

      const getRankingValue = (seriesValues: (number | null)[]): number => {
        for (let i = targetIdx; i >= startIdx; i--) {
          const val = seriesValues[i];
          if (val != null && !Number.isNaN(val)) return val;
        }
        return 0;
      };

      const activeCodes = Object.keys(config.chartData.series)
        .sort((a, b) => getRankingValue(config.chartData.series[b]) - getRankingValue(config.chartData.series[a]))
        .slice(0, topN);

      const series = activeCodes
        .filter((entityCode) => config.chartData.series[entityCode] != null)
        .map((entityCode): LineSeriesOption => {
          const values = config.chartData.series[entityCode];
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
