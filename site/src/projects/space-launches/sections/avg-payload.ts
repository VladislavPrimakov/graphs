import { createChart } from '@/components/sections/SectionChart';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';

/** Section builder for Average Payload to Orbit by Decade chart. */
export const avgPayloadSection: Section = ({ t, fmt, tokens }) => ({
  id: 'avg-payload',
  title: t.proj.avgPayload.title,
  sources: [{ name: 'The Space Devs — Launch Library 2 API', url: 'https://ll.thespacedevs.com/2.3.0/launches/' }],
  buildView: ({ spaceLaunchesData }, { launchesStore }) => {
    const data = spaceLaunchesData['avg-payload'];
    const summary = data.summary;
    const allRegions = data.regions;
    const selectedRegions = launchesStore.countries.length ? (launchesStore.countries as string[]).filter((r) => allRegions.includes(r)) : allRegions;
    const activeRegions = selectedRegions.length > 0 ? selectedRegions : allRegions;

    return {
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
      content: createChart(
        chartOption({
          title: { text: t.proj.avgPayload.title },
          tooltip: {
            type: 'axis',
            header: ({ dataIndex }) => {
              const rawDecade = data.avgPayload.decades[dataIndex];
              return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
            },
            sort: 'desc',
            row: ({ seriesName, value, seriesId, data: pointData }) => {
              if (seriesId === 'average') return undefined;
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
                color: 'warning',
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
          series: [
            ...activeRegions.map((region: string) => ({
              id: region,
              name: fmt.region(region),
              type: 'bar' as const,
              color: fmt.regionColor(region),
              data: zipRecords({
                value: data.avgPayload.series[region] || [],
                launches: data.avgPayload.launches?.[region] || [],
              }),
            })),
            {
              id: 'average',
              name: t.common.average,
              type: 'line' as const,
              smooth: true,
              z: 3,
              color: tokens.status.warning,
              lineStyle: { width: 2.5 },
              symbol: 'circle',
              symbolSize: 6,
              data: zipRecords({
                value: data.avgPayload.totalAvgPayload,
                launches: data.avgPayload.totalLaunches,
              }),
            },
          ],
        }),
      ),
    };
  },
});
