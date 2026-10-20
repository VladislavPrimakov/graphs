import type { FrontlineDynamicsSectionData } from '@graphs/types/war-rf-ua/frontline';
import type { SeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, resolveEffectiveMax, zipRecords } from '@/utils/chart-builder';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';
import { frontlineColors } from '../tokens';

interface PointWithPct {
  value?: number;
  pct?: number;
  km2?: number;
}

/** Section builder for Frontline & Territorial Dynamics chart. */
export const frontlineDynamicsSection = defineSection(({ t, fmt }: ProjectContext<typeof dict>) => {
  return {
    id: 'frontline-dynamics',
    title: t.proj.frontlineDynamics.titleNetChange,
    sources: [
      { name: 'DeepStateMAP', url: 'https://deepstatemap.live' },
      { name: 'LostArmour', url: 'https://lostarmour.info/map' },
    ],
    data: {
      dynamics: () => loadDataset<FrontlineDynamicsSectionData>('war-rf-ua', 'frontline-dynamics.json'),
    },
    toolbars: [
      {
        id: 'dynamics',
        controls: [
          {
            id: 'metric',
            type: 'toggle',
            defaultValue: 'netChange',
            label: t.common.metric,
            options: [
              { value: 'netChange', label: t.proj.frontlineDynamics.netChange },
              { value: 'area', label: t.proj.frontlineDynamics.area },
            ],
          },
        ] as const,
      },
    ] as const,
    buildView: ({ dynamics: data }, { dynamics, frontline }) => {
      const { monthly } = data;
      const metric = dynamics?.metric ?? 'netChange';
      const [dateFrom, dateTo] = frontline?.period ?? [monthly.months[0], monthly.months[monthly.months.length - 1]];
      const fromMonth = dateFrom ? dateFrom.slice(0, 7) : monthly.months[0];
      const toMonth = dateTo ? dateTo.slice(0, 7) : monthly.months[monthly.months.length - 1];

      const monthIndices = monthly.months
        .map((m, idx) => ({ month: m, idx }))
        .filter((item) => item.month >= fromMonth && item.month <= toMonth)
        .map((item) => item.idx);

      const visibleLabels = monthIndices.map((i) => monthly.labels[i]);
      const visibleMonths = monthIndices.map((i) => monthly.months[i]);

      const filteredConsensusRf = monthIndices.map((i) => monthly.consensusRfKm2[i]);
      const filteredConsensusUa = monthIndices.map((i) => monthly.consensusUaKm2[i]);
      const filteredDisputed = monthIndices.map((i) => monthly.disputedKm2[i]);
      const filteredConsensusRfPct = monthIndices.map((i) => monthly.consensusRfPct[i]);
      const filteredConsensusUaPct = monthIndices.map((i) => monthly.consensusUaPct[i]);
      const filteredDisputedPct = monthIndices.map((i) => monthly.disputedPct[i]);

      if (metric === 'netChange') {
        const rfAdvances = monthIndices.map((i) => monthly.rfAdvanceKm2[i]);
        const uaLiberated = monthIndices.map((i) => monthly.uaLiberatedKm2[i]);
        const netChanges = monthIndices.map((i) => monthly.netChangeKm2[i]);

        // Discard the single maximum outlier bar to keep regular months readable
        const yMax =
          resolveEffectiveMax(rfAdvances, {
            ratio: 2.5,
            headroom: 1.25,
            roundStep: 500,
            fallbackMin: 1000,
            alwaysClamp: true,
          }) ?? 1000;

        const maxUaLib = Math.max(...uaLiberated, 0);
        const yMin = -Math.max(1000, Math.ceil((maxUaLib * 1.1) / 500) * 500);

        const barData = rfAdvances.map((adv) => {
          const isClamped = adv > yMax;
          return {
            value: isClamped ? yMax : adv,
            realValue: adv,
            isClamped,
          };
        });

        const netData = netChanges.map((net) => {
          const isClamped = net > yMax;
          return {
            value: isClamped ? yMax : net,
            realValue: net,
            isClamped,
          };
        });

        const series: SeriesOption[] = [
          createBarSeries({
            id: 'rf_advance',
            name: t.proj.frontlineDynamics.rfAdvance,
            stack: 'net',
            color: frontlineColors.consensusRf,
            data: barData,
            formatLabel: ({ item }) => {
              if (item?.isClamped) {
                return `+${fmt.number(Math.round(item.realValue / 1000))}k km² ⚡`;
              }
              return undefined;
            },
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
            color: frontlineColors.netChange,
            lineStyle: { width: 2.5 },
            data: netData,
          },
        ];

        return {
          title: t.proj.frontlineDynamics.titleNetChange,
          content: createChart(
            chartOption({
              tooltip: {
                type: 'axis',
                header: ({ dataIndex }) => `${t.common.period}: ${visibleMonths[dataIndex]}`,
                row: ({ seriesName, value, seriesId, data: rowData }) => {
                  const item = rowData as { realValue?: number } | undefined;
                  const rawVal = item?.realValue ?? value;
                  const sign = seriesId === 'ua_liberated' || (seriesId === 'net_change' && rawVal < 0) ? '' : rawVal > 0 ? '+' : '';
                  const displayVal = seriesId === 'ua_liberated' ? `-${fmt.number(Math.abs(rawVal))}` : `${sign}${fmt.number(rawVal)}`;
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
                min: yMin,
                max: yMax,
                axisLabel: {
                  formatter: (val: number) => fmt.number(Math.abs(val)),
                },
              },
              series,
            }),
          ),
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
        content: createChart(
          chartOption({
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
        ),
      };
    },
  };
});
