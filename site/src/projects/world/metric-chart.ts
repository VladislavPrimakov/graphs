import type { WorldMetricSectionData } from '@graphs/shared/types/world';
import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption } from '@/utils/chart-builder';
import type { ProjectContext, ProjectSource } from '@/utils/project';
import type { dict } from './locales/dict-en';
import type { Section } from './project';

export interface WorldMetricConfig {
  id: string;
  title: string;
  unit: string;
  sources?: ProjectSource[];
}

/** Shared builder for world economic and energy line chart sections. */
export const createWorldMetricSection =
  (config: (ctx: ProjectContext<typeof dict>) => WorldMetricConfig): Section =>
  (ctx) => {
    const { fmt } = ctx;
    const cfg = config(ctx);

    return {
      id: cfg.id,
      title: cfg.title,
      sources: cfg.sources,
      buildView: ({ worldData }, { worldStore }) => {
        const data = (worldData as unknown as Record<string, WorldMetricSectionData>)[cfg.id];
        const { years, series: chartSeries } = data;
        const [startYear, endYear] = worldStore.years;

        const foundStartIdx = years.findIndex((y) => y >= startYear);
        const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
        const foundEndIdx = years.findLastIndex((y) => y <= endYear);
        const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;
        const targetIdx = endIdx - 1;

        const visibleYears = years.slice(startIdx, endIdx).map(String);

        const getRankingValue = (seriesValues: (number | null)[]): number => {
          for (let i = targetIdx; i >= startIdx; i--) {
            const val = seriesValues[i];
            if (val != null && !Number.isNaN(val)) return val;
          }
          return 0;
        };

        const hasSelectedCountries = worldStore.countries.length > 0;
        const candidateCodes = hasSelectedCountries ? (worldStore.countries as string[]).filter((code) => chartSeries[code] != null) : Object.keys(chartSeries);

        const activeCodes = candidateCodes.sort((a, b) => getRankingValue(chartSeries[b]) - getRankingValue(chartSeries[a])).slice(0, hasSelectedCountries ? candidateCodes.length : worldStore.top);

        const formatValue = (val: number) => fmt.number(val, val >= 100 ? { maximumFractionDigits: 0 } : undefined);

        const series = activeCodes
          .filter((entityCode) => chartSeries[entityCode] != null)
          .map((entityCode): LineSeriesOption => {
            const valArr = chartSeries[entityCode];
            const regionCode = entityCode;
            const name = fmt.region(regionCode);
            const color = fmt.regionColor(regionCode);

            return {
              id: entityCode,
              name,
              type: 'line',
              color,
              data: valArr.slice(startIdx, endIdx),
              endLabel: {
                formatter: ({ value, seriesName }) => (typeof value === 'number' ? `${seriesName}: ${formatValue(value)}` : ''),
              },
            };
          });

        return {
          content: createChart(
            chartOption({
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
                name: cfg.unit,
              },
              series,
            }),
          ),
        };
      },
    };
  };
