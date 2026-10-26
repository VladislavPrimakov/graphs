import type { CleanPowerSectionData, WorldFilterState } from '@graphs/shared/types/world';
import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, resolveEffectiveMax } from '@/utils/chart-builder';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';

/** Section builder for Clean Power Generation (Renewables & Nuclear) chart. */
export const cleanPowerSection = defineSection(({ t, fmt }: ProjectContext<typeof dict>) => {
  const unit = fmt.unitName('energy-terawatt-hour');

  return {
    id: 'clean-power',
    title: t.proj.cleanPower.title,
    sources: [
      { name: 'Ember — Global Electricity Review (Solar & Wind)', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
      { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
    ],
    data: {
      sectionData: () => loadDataset<CleanPowerSectionData>('world', 'clean-power.json'),
    },
    buildView: ({ sectionData }, { worldStore }: { worldStore: WorldFilterState }) => {
      const isGrowth = worldStore.mode === 'growth';
      const { years, series: chartSeries, growth: growthSeries } = sectionData;
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

      const formatVolume = (val: number) => fmt.number(val, val >= 100 ? { maximumFractionDigits: 0 } : undefined);
      const formatGrowth = (val: number) => `${val > 0 ? '+' : ''}${fmt.percent(val)}`;

      const activeSeriesMap = isGrowth ? (growthSeries ?? {}) : chartSeries;

      const series: LineSeriesOption[] = activeCodes
        .filter((entityCode) => activeSeriesMap[entityCode] != null)
        .map((entityCode): LineSeriesOption => {
          const valArr = activeSeriesMap[entityCode];
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
              formatter: ({ value, seriesName }) => {
                if (typeof value !== 'number' || Number.isNaN(value)) return '';
                const formatted = isGrowth ? formatGrowth(value) : formatVolume(value);
                return `${seriesName}: ${formatted}`;
              },
            },
          };
        });

      const visibleGrowthSeries = activeCodes.map((code) => growthSeries?.[code]?.slice(startIdx, endIdx) ?? []);
      const yMax = isGrowth ? resolveEffectiveMax(visibleGrowthSeries, { roundStep: 5, fallbackMin: 10 }) : undefined;

      return {
        content: createChart(
          chartOption({
            legend: { show: false },
            tooltip: {
              type: 'axis',
              sort: 'desc',
              row: ({ value, seriesId, dataIndex }) => {
                const numVal = typeof value === 'number' ? value : Number(value);
                const actualIndex = startIdx + dataIndex;
                const sId = String(seriesId);
                if (isGrowth) {
                  const volVal = chartSeries[sId]?.[actualIndex];
                  const subValue = volVal != null ? `${formatVolume(volVal)} ${unit}` : undefined;
                  return {
                    value: formatGrowth(numVal),
                    subValue,
                  };
                }
                const grVal = growthSeries?.[sId]?.[actualIndex];
                const subValue = grVal != null ? formatGrowth(grVal) : undefined;
                return {
                  value: `${formatVolume(numVal)} ${unit}`,
                  subValue,
                };
              },
            },
            xAxis: {
              type: 'category',
              data: visibleYears,
            },
            yAxis: {
              type: 'value',
              name: isGrowth ? '%' : unit,
              ...(yMax != null ? { max: yMax } : {}),
            },
            series,
          }),
        ),
      };
    },
  };
});
