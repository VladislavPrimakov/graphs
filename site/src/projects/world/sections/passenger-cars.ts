import type { PassengerCarsSectionData } from '@graphs/shared/types/world';
import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, resolveEffectiveMax, resolveVisiblePeriod } from '@/utils/chart-builder';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';

/** Section builder for Passenger Cars per 1,000 Inhabitants chart. */
export const passengerCarsSection = defineSection(({ t, fmt }: ProjectContext<typeof dict>) => {
  const unit = fmt.unitName('vehicle-car-per-1000-person');

  return {
    id: 'passenger-cars',
    title: t.proj.passengerCars.title,
    sources: [
      { name: 'International Transport Forum (ITF / OECD)', url: 'https://www.itf-oecd.org/' },
      { name: 'UNECE Sustainable Transport Division', url: 'https://unece.org/transport' },
    ],
    data: {
      sectionData: () => loadDataset<PassengerCarsSectionData>('world', 'passenger-cars.json'),
    },
    buildView: ({ sectionData }, { worldStore }) => {
      const isGrowth = worldStore.mode === 'growth';
      const { years, series: chartSeries, growth: growthSeries } = sectionData;
      const { startIdx: rankStartIdx, targetIdx: rankTargetIdx } = resolveVisiblePeriod(years, worldStore.years);

      const getRankingValue = (seriesValues: (number | null)[]): number => {
        for (let i = rankTargetIdx; i >= rankStartIdx; i--) {
          const val = seriesValues[i];
          if (val != null && !Number.isNaN(val)) return val;
        }
        return 0;
      };

      const hasSelectedCountries = worldStore.countries.length > 0;
      const candidateCodes = hasSelectedCountries ? (worldStore.countries as string[]).filter((code) => chartSeries[code] != null) : Object.keys(chartSeries);

      const rankValues = new Map(candidateCodes.map((code) => [code, getRankingValue(chartSeries[code])]));
      const activeCodes = candidateCodes.sort((a, b) => (rankValues.get(b) ?? 0) - (rankValues.get(a) ?? 0)).slice(0, hasSelectedCountries ? candidateCodes.length : worldStore.top);

      const formatVolume = (val: number) => fmt.number(val, { maximumFractionDigits: 1 });
      const formatGrowth = (val: number) => `${val > 0 ? '+' : ''}${fmt.percent(val)}`;

      const activeSeriesMap = isGrowth ? (growthSeries ?? {}) : chartSeries;
      const { startIdx, endIdx, visibleYears } = resolveVisiblePeriod(years, worldStore.years, {
        seriesData: activeCodes.map((code) => activeSeriesMap[code]),
      });

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

      const yMax = isGrowth
        ? resolveEffectiveMax(
            activeCodes.map((code) => growthSeries?.[code]?.slice(startIdx, endIdx) ?? []),
            { roundStep: 5, fallbackMin: 10 },
          )
        : undefined;

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
