import type { FrontlineDynamicsSectionData } from '@graphs/types/war-rf-ua/frontline-dynamics';
import type { SeriesOption } from 'echarts';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { frontlineColors } from '../tokens';

interface PointWithPct {
  value?: number;
  pct?: number;
  km2?: number;
}

/** Section builder for Frontline & Territorial Dynamics chart. */
export const frontlineDynamicsSection: SectionBuilder<FrontlineDynamicsSectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'frontline-dynamics',
    title: t.proj.frontlineDynamics.titleNetChange,
    sources: [
      { name: 'DeepStateMAP', url: 'https://deepstatemap.live' },
      { name: 'LostArmour', url: 'https://lostarmour.info/map' },
    ],
    controls: (data) =>
      [
        {
          id: 'metric',
          type: 'toggle',
          defaultValue: 'netChange',
          label: t.common.metric,
          options: [
            { value: 'netChange', label: t.proj.frontlineDynamics.netChange },
            { value: 'area', label: t.proj.frontlineDynamics.area },
            { value: 'share', label: t.common.share },
          ],
        },
        {
          id: 'years',
          type: 'range-slider',
          min: data.monthly.years[0],
          max: data.monthly.years[data.monthly.years.length - 1],
          defaultValue: [data.monthly.years[0], data.monthly.years[data.monthly.years.length - 1]],
          label: t.common.period,
        },
      ] as const,
    buildView: (data, values) => {
      const { summary, monthly } = data;
      const [startYear, endYear] = values.years;

      const monthIndices = monthly.months
        .map((m, idx) => ({ year: Number.parseInt(m.split('-')[0], 10), idx }))
        .filter((item) => item.year >= startYear && item.year <= endYear)
        .map((item) => item.idx);

      const visibleLabels = monthIndices.map((i) => monthly.labels[i]);
      const visibleMonths = monthIndices.map((i) => monthly.months[i]);

      const filteredConsensusRf = monthIndices.map((i) => monthly.consensusRfKm2[i]);
      const filteredConsensusUa = monthIndices.map((i) => monthly.consensusUaKm2[i]);
      const filteredDisputed = monthIndices.map((i) => monthly.disputedKm2[i]);
      const filteredConsensusRfPct = monthIndices.map((i) => monthly.consensusRfPct[i]);
      const filteredConsensusUaPct = monthIndices.map((i) => monthly.consensusUaPct[i]);
      const filteredDisputedPct = monthIndices.map((i) => monthly.disputedPct[i]);

      const kpisTop = [
        {
          label: t.proj.frontlineDynamics.kpis.currentRfControl,
          value: `${fmt.number(summary.currentRfKm2)} km² (${fmt.percent(summary.currentRfPct, { maximumFractionDigits: 2 })})`,
          valueColor: frontlineColors.consensusRf,
        },
        {
          label: t.proj.frontlineDynamics.kpis.currentUaControl,
          value: `${fmt.number(summary.currentUaKm2)} km² (${fmt.percent(summary.currentUaPct, { maximumFractionDigits: 2 })})`,
          valueColor: frontlineColors.consensusUa,
        },
      ];

      if (values.metric === 'share') {
        const series: SeriesOption[] = [
          {
            id: 'consensus_rf_pct',
            name: t.proj.frontlineDynamics.consensusRf,
            type: 'line',
            smooth: true,
            color: frontlineColors.consensusRf,
            data: zipRecords({
              value: filteredConsensusRfPct,
              km2: filteredConsensusRf,
            }),
            areaStyle: { opacity: 0.2 },
            lineStyle: { width: 2.5 },
          },
          {
            id: 'disputed_pct',
            name: t.proj.frontlineDynamics.disputed,
            type: 'line',
            smooth: true,
            color: frontlineColors.disputed,
            data: zipRecords({
              value: filteredDisputedPct,
              km2: filteredDisputed,
            }),
            areaStyle: { opacity: 0.2 },
            lineStyle: { width: 2 },
          },
          {
            id: 'consensus_ua_pct',
            name: t.proj.frontlineDynamics.consensusUa,
            type: 'line',
            smooth: true,
            color: frontlineColors.consensusUa,
            data: zipRecords({
              value: filteredConsensusUaPct,
              km2: filteredConsensusUa,
            }),
            areaStyle: { opacity: 0.15 },
            lineStyle: { width: 2 },
          },
        ];

        return {
          title: t.proj.frontlineDynamics.titleShare,
          kpisTop,
          option: chartOption({
            title: { text: t.proj.frontlineDynamics.titleShare },
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleMonths[dataIndex]}`,
              row: ({ seriesName, value, data: rowData }) => {
                const item = rowData as PointWithPct | undefined;
                const km2Str = item?.km2 != null ? ` (${fmt.number(item.km2)} km²)` : '';
                return {
                  label: seriesName,
                  value: `${fmt.percent(value, { maximumFractionDigits: 2 })}${km2Str}`,
                };
              },
            },
            xAxis: {
              type: 'category',
              data: visibleLabels,
            },
            yAxis: {
              type: 'value',
              name: '%',
              min: 0,
              max: 100,
            },
            series,
          }),
        };
      }

      if (values.metric === 'netChange') {
        const rfAdvances = monthIndices.map((i) => monthly.rfAdvanceKm2[i]);
        const uaLiberated = monthIndices.map((i) => monthly.uaLiberatedKm2[i]);
        const netChanges = monthIndices.map((i) => monthly.netChangeKm2[i]);

        const series: SeriesOption[] = [
          createBarSeries({
            id: 'rf_advance',
            name: t.proj.frontlineDynamics.rfAdvance,
            stack: 'net',
            color: frontlineColors.consensusRf,
            data: zipRecords({
              value: rfAdvances,
            }),
          }),
          createBarSeries({
            id: 'ua_liberated',
            name: t.proj.frontlineDynamics.uaLiberated,
            stack: 'net',
            color: frontlineColors.consensusUa,
            data: zipRecords({
              value: uaLiberated.map((v) => -Math.abs(v)),
            }),
          }),
          {
            id: 'net_change',
            name: t.proj.frontlineDynamics.netMonthlyChange,
            type: 'line',
            smooth: true,
            color: '#f59e0b',
            lineStyle: { width: 2.5 },
            data: zipRecords({
              value: netChanges,
            }),
          },
        ];

        return {
          title: t.proj.frontlineDynamics.titleNetChange,
          kpisTop,
          option: chartOption({
            title: { text: t.proj.frontlineDynamics.titleNetChange },
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleMonths[dataIndex]}`,
              row: ({ seriesName, value, seriesId }) => {
                const sign = seriesId === 'ua_liberated' || (seriesId === 'net_change' && value < 0) ? '' : value > 0 ? '+' : '';
                const displayVal = seriesId === 'ua_liberated' ? `-${fmt.number(Math.abs(value))}` : `${sign}${fmt.number(value)}`;
                return {
                  label: seriesName,
                  value: `${displayVal} km²`,
                };
              },
            },
            xAxis: {
              type: 'category',
              data: visibleLabels,
            },
            yAxis: {
              type: 'value',
              name: 'km²',
              axisLabel: {
                formatter: (val: number) => fmt.number(Math.abs(val)),
              },
            },
            series,
          }),
        };
      }

      const series: SeriesOption[] = [
        {
          id: 'consensus_rf',
          name: t.proj.frontlineDynamics.consensusRf,
          type: 'line',
          smooth: true,
          color: frontlineColors.consensusRf,
          data: zipRecords({
            value: filteredConsensusRf,
            pct: filteredConsensusRfPct,
          }),
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2.5 },
        },
        {
          id: 'disputed',
          name: t.proj.frontlineDynamics.disputed,
          type: 'line',
          smooth: true,
          color: frontlineColors.disputed,
          data: zipRecords({
            value: filteredDisputed,
            pct: filteredDisputedPct,
          }),
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2 },
        },
        {
          id: 'consensus_ua',
          name: t.proj.frontlineDynamics.consensusUa,
          type: 'line',
          smooth: true,
          color: frontlineColors.consensusUa,
          data: zipRecords({
            value: filteredConsensusUa,
            pct: filteredConsensusUaPct,
          }),
          areaStyle: { opacity: 0.1 },
          lineStyle: { width: 2 },
        },
      ];

      return {
        title: t.proj.frontlineDynamics.titleArea,
        kpisTop,
        option: chartOption({
          title: { text: t.proj.frontlineDynamics.titleArea },
          tooltip: {
            type: 'axis',
            header: ({ dataIndex }) => `${t.common.period}: ${visibleMonths[dataIndex]}`,
            row: ({ seriesName, value, data: rowData }) => {
              const item = rowData as PointWithPct | undefined;
              const pctStr = item?.pct != null ? ` (${fmt.percent(item.pct, { maximumFractionDigits: 2 })})` : '';
              return {
                label: seriesName,
                value: `${fmt.number(value)} km²${pctStr}`,
              };
            },
          },
          xAxis: {
            type: 'category',
            data: visibleLabels,
          },
          yAxis: {
            type: 'value',
            name: 'km²',
          },
          series,
        }),
      };
    },
  });
};
