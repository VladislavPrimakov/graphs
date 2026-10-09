import type { LaunchCostsSectionData } from '@graphs/types/space-launches/launch-costs';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Launch Costs to LEO by Decade chart. */
export const launchCostsSection: SectionBuilder<LaunchCostsSectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'launch-costs',
    title: t.proj.launchCosts.title,
    sources: [
      { name: 'CSIS Aerospace Security Project & BryceTech', url: 'https://aerospace.csis.org/data/space-launch-cost/' },
      { name: 'The Space Devs — Launch Library 2 API', url: 'https://ll.thespacedevs.com/2.3.0/launches/' },
    ],
    controls: (data) => {
      const regionCount = Object.keys(data.decadeCosts.series).length;
      return [
        {
          id: 'topN',
          type: 'slider',
          min: Math.min(3, regionCount),
          max: regionCount,
          defaultValue: Math.min(7, regionCount),
          label: t.common.top,
        },
      ] as const;
    },
    buildView: (data, values) => {
      const summary = data.summary;
      const costRegions = Object.keys(data.decadeCosts.series);
      const topN = values.topN;
      const activeCostRegions = costRegions.slice(0, topN);

      return {
        kpisTop: [
          {
            label: `${t.proj.launchCosts.kpis.bestAvgCost} (${fmt.decade(summary.bestDecadeAvgCostDecade)})`,
            value: fmt.per(fmt.currency(summary.bestDecadeAvgCostPerKg), 'mass-kilogram'),
            valueColor: 'success',
          },
          {
            label: `${t.proj.launchCosts.kpis.costReduction} (${fmt.decade(summary.worstDecadeAvgCostDecade)}: ${fmt.per(fmt.currency(summary.worstDecadeAvgCostPerKg), 'mass-kilogram')} → ${fmt.decade(summary.bestDecadeAvgCostDecade)}: ${fmt.per(fmt.currency(summary.bestDecadeAvgCostPerKg), 'mass-kilogram')})`,
            value: `${summary.costReductionFactor}×`,
            valueColor: 'primary',
          },
          {
            label: `${t.proj.launchCosts.kpis.lowestCost} (${fmt.region(summary.lowestCostRegion)}, ${fmt.decade(summary.lowestCostDecade)})`,
            value: fmt.per(fmt.currency(summary.lowestCostPerKg), 'mass-kilogram'),
            valueColor: 'info',
          },
        ],
        option: chartOption({
          title: { text: `${t.proj.launchCosts.title} (${t.common.top} ${topN})` },
          tooltip: {
            type: 'axis',
            header: ({ dataIndex }) => {
              const rawDecade = data.decadeCosts.decades[dataIndex];
              return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
            },
            sort: 'asc',
            row: ({ seriesName, value, data: pointData }) => {
              const launches = pointData.launches;
              return {
                label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
                value: fmt.currency(value),
              };
            },
            footer: ({ dataIndex }) => {
              const totalLaunches = data.decadeCosts.totalLaunches[dataIndex] || 0;
              const totalAvgCost = data.decadeCosts.totalAvgCost[dataIndex];
              if (totalAvgCost == null) return undefined;
              const totalLabel = totalLaunches > 0 ? `${t.common.average} (${fmt.number(totalLaunches)})` : t.common.average;
              return {
                label: totalLabel,
                value: fmt.currency(totalAvgCost),
              };
            },
          },
          xAxis: {
            type: 'category',
            data: data.decadeCosts.decades.map(fmt.decade),
          },
          yAxis: {
            type: 'log',
            logBase: 10,
            name: fmt.per('$', 'mass-kilogram'),
          },
          series: activeCostRegions.map((region: string) => ({
            id: region,
            name: fmt.region(region),
            type: 'bar' as const,
            color: fmt.regionColor(region),
            data: zipRecords({
              value: data.decadeCosts.series[region] || [],
              launches: data.decadeCosts.launches?.[region] || [],
            }),
          })),
        }),
      };
    },
  });
};
