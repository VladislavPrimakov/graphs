import type { PayloadCapacitySectionData } from '@graphs/types/space-launches/payload-capacity';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Annual Payload Capacity to Orbit chart. */
export const payloadCapacitySection: SectionBuilder<PayloadCapacitySectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'payload-capacity',
    title: t.proj.payloadCapacity.title,
    sources: [{ name: 'The Space Devs — Launch Library 2 API', url: 'https://ll.thespacedevs.com/2.3.0/launches/' }],
    controls: (data) =>
      [
        {
          id: 'mode',
          type: 'toggle',
          defaultValue: 'value',
          label: t.common.metric,
          options: [
            { value: 'value', label: `${t.common.volume} (${fmt.unitName('mass-tonne', { style: 'short' })})` },
            { value: 'share', label: `${t.common.share} (%)` },
          ],
        },
        {
          id: 'topN',
          type: 'slider',
          min: Math.min(3, data.regions.length),
          max: data.regions.length,
          defaultValue: Math.min(7, data.regions.length),
          label: t.common.top,
        },
      ] as const,
    buildView: (data, values) => {
      const summary = data.summary;
      const allRegions = data.regions;
      const isShare = values.mode === 'share';
      const topN = values.topN;
      const activeRegions = allRegions.slice(0, topN);

      const activeYearTotals = data.payloadCapacity.years.map((_, yearIdx) => {
        let mass = 0;
        let launches = 0;
        for (const r of activeRegions) {
          mass += data.payloadCapacity.series[r]?.[yearIdx] || 0;
          launches += data.payloadCapacity.launches?.[r]?.[yearIdx] || 0;
        }
        return {
          mass: Math.round(mass * 10) / 10,
          launches,
        };
      });

      return {
        kpisTop: [
          {
            label: t.proj.payloadCapacity.kpis.totalLaunches,
            value: fmt.number(summary.totalAttempts),
            valueColor: 'success',
          },
          {
            label: t.proj.payloadCapacity.kpis.totalPayload,
            value: fmt.unit(summary.totalPayloadTons, 'mass-tonne'),
            valueColor: 'primary',
          },
          {
            label: `${t.proj.payloadCapacity.kpis.leaderShare} (${fmt.region(summary.leaderAllTimeRegion)})`,
            value: `${fmt.unit(summary.leaderAllTimeMassTons, 'mass-tonne')} (${fmt.percent(summary.leaderAllTimeShare)})`,
            valueColor: 'info',
          },
        ],
        option: chartOption({
          title: { text: `${t.proj.payloadCapacity.title} (${t.common.top} ${topN})` },
          dataZoom: [{ type: 'slider' }, { type: 'inside' }],
          tooltip: {
            type: 'axis',
            header: ({ name }) => `${t.common.period}: ${name}`,
            sort: 'desc',
            row: ({ seriesName, data: pointData }) => {
              const launches = pointData.launches;
              return {
                label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
                value: isShare ? fmt.percent(pointData.share) : fmt.unit(pointData.val, 'mass-tonne'),
                subValue: isShare ? fmt.unit(pointData.val, 'mass-tonne') : fmt.percent(pointData.share),
              };
            },
            footer: ({ dataIndex }) => {
              const activeTot = activeYearTotals[dataIndex];
              const totalLaunches = activeTot?.launches || 0;
              const totalPayload = activeTot?.mass || 0;
              const totalLabel = totalLaunches > 0 ? `${t.common.total} (${fmt.number(totalLaunches)})` : t.common.total;
              return {
                label: totalLabel,
                value: fmt.unit(totalPayload, 'mass-tonne'),
              };
            },
          },
          xAxis: {
            type: 'category',
            data: data.payloadCapacity.years.map(String),
          },
          yAxis: {
            type: 'value',
            name: isShare ? '%' : fmt.unitName('mass-tonne', { style: 'long' }),
            min: 0,
            max: isShare ? 100 : undefined,
          },
          series: activeRegions.map((region: string) => {
            const valList = data.payloadCapacity.series[region] || [];
            const launchList = data.payloadCapacity.launches?.[region] || [];
            const shareList = valList.map((val, idx) => {
              const tot = activeYearTotals[idx].mass;
              return tot > 0 ? Math.round((val / tot) * 1000) / 10 : 0;
            });

            return {
              id: region,
              name: fmt.region(region),
              type: 'line' as const,
              stack: 'Total',
              showSymbol: false,
              color: fmt.regionColor(region),
              areaStyle: { opacity: 0.85 },
              data: zipRecords({
                value: isShare ? shareList : valList,
                val: valList,
                share: shareList,
                launches: launchList,
              }),
            };
          }),
        }),
      };
    },
  });
};
