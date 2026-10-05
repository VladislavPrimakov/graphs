import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Average Payload to Orbit by Decade chart. */
export const avgPayloadSection: SectionBuilder<'space-launches', typeof dict> = ({ data, t, fmt }) => {
  const summary = data.summary;
  const allRegions = data.regions;

  return chartSection({
    id: 'avg-payload',
    title: t.proj.avgPayload.title,
    kpisTop: [
      {
        label: `${t.proj.avgPayload.kpis.bestAvgPayload} (${fmt.decade(summary.bestDecadeAvgPayloadDecade)})`,
        value: fmt.unit(summary.currentDecadeAvgPayloadKg, 'mass-kilogram'),
        valueColor: 'success',
      },
      {
        label: `${t.proj.avgPayload.kpis.payloadGrowth} (${fmt.decade(summary.worstDecadeAvgPayloadDecade)}: ${fmt.unit(summary.baselineAvgPayloadKg, 'mass-kilogram')} → ${fmt.decade(summary.bestDecadeAvgPayloadDecade)}: ${fmt.unit(summary.currentDecadeAvgPayloadKg, 'mass-kilogram')})`,
        value: `${summary.payloadGrowthFactor}×`,
        valueColor: 'primary',
      },
      {
        label: `${t.proj.avgPayload.kpis.heavyClassRecord} (${fmt.region(summary.bestDecadeCountryAvgPayloadRegion)}, ${fmt.decade(summary.bestDecadeCountryAvgPayloadDecade)})`,
        value: fmt.unit(summary.bestDecadeCountryAvgPayloadKg, 'mass-kilogram'),
        valueColor: 'info',
      },
    ],
    controls: [
      {
        id: 'topN',
        type: 'slider',
        min: Math.min(3, allRegions.length),
        max: Math.min(15, allRegions.length),
        defaultValue: Math.min(7, allRegions.length),
        label: t.common.top,
      },
    ],
    buildView: (values) => {
      const topN = values.topN;
      const activeRegions = allRegions.slice(0, topN);

      return chartOption({
        title: { text: `${t.proj.avgPayload.title} (${t.common.top} ${topN})` },
        tooltip: {
          type: 'axis',
          header: ({ dataIndex }) => {
            const rawDecade = data.avgPayload.decades[dataIndex];
            return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
          },
          sort: 'desc',
          row: ({ seriesName, value, data: pointData }) => {
            const launches = pointData.launches;
            return {
              label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
              value: fmt.unit(value, 'mass-kilogram'),
            };
          },
          footer: ({ dataIndex }) => {
            const totalLaunches = data.avgPayload.totalLaunches[dataIndex] || 0;
            const totalAvgPayload = data.avgPayload.totalAvgPayload[dataIndex];
            if (totalAvgPayload == null) return undefined;
            const totalLabel = totalLaunches > 0 ? `${t.common.average} (${fmt.number(totalLaunches)})` : t.common.average;
            return {
              label: totalLabel,
              value: fmt.unit(totalAvgPayload, 'mass-kilogram'),
            };
          },
        },
        xAxis: {
          type: 'category',
          data: data.avgPayload.decades.map(fmt.decade),
        },
        yAxis: {
          type: 'value',
          name: fmt.per(fmt.unitName('mass-kilogram'), 'event-launch'),
        },
        series: activeRegions.map((region: string) => ({
          id: region,
          name: fmt.region(region),
          type: 'bar' as const,
          color: fmt.regionColor(region),
          data: zipRecords({
            value: data.avgPayload.series[region] || [],
            launches: data.avgPayload.launches?.[region] || [],
          }),
        })),
      });
    },
  });
};
