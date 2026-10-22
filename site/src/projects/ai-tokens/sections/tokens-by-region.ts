import { createChart } from '@/components/sections/SectionChart';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';

/** Section builder for Daily AI Inference Tokens by Macro-Region chart. */
export const tokensByRegionSection: Section = ({ t, fmt }) => {
  const tpdUnit = fmt.per(fmt.scale(1e12), 'duration-day');

  return {
    id: 'tokens-by-region',
    title: t.proj.tokensByRegion.title,
    sources: [
      { name: 'Tokens Per Day', url: 'https://tokensperday.com/' },
      { name: 'National Data Bureau of China', url: 'https://www.ndb.gov.cn/' },
      { name: 'OpenRouter Telemetry', url: 'https://openrouter.ai/' },
    ],
    toolbars: [
      {
        id: 'regionStore',
        urlPrefix: 'region',
        controls: [
          {
            id: 'mode',
            type: 'toggle',
            defaultValue: 'value',
            label: t.common.metric,
            options: [
              { value: 'value', label: `${t.common.volume} (${tpdUnit})` },
              { value: 'share', label: `${t.common.share} (%)` },
            ],
          },
        ] as const,
      },
    ] as const,
    buildView: ({ aiTokensData }, { regionStore }) => {
      const { summary, regions } = aiTokensData;
      const isShare = regionStore.mode === 'share';
      return {
        kpisTop: [
          {
            label: `${t.proj.tokensByRegion.kpis.peakDaily} (${summary.peakMonth})`,
            value: `${fmt.number(summary.peakDailyTokens)} ${tpdUnit}`,
            valueColor: 'primary',
          },
          {
            label: `${t.proj.tokensByRegion.kpis.topRegion} (${fmt.region(summary.topRegionCode)} — ${summary.peakMonth})`,
            value: `${fmt.number(summary.topRegionValue)} ${tpdUnit} (${fmt.percent(summary.topRegionShare)})`,
            valueColor: 'danger',
          },
        ],
        content: createChart(
          chartOption({
            title: { text: t.proj.tokensByRegion.title },
            tooltip: {
              type: 'axis',
              header: ({ name }) => `${t.common.period}: ${name}`,
              sort: 'desc',
              row: ({ seriesName, data: pointData, color }) => ({
                label: seriesName,
                value: isShare ? fmt.percent(pointData.share) : `${fmt.number(pointData.val)} ${tpdUnit}`,
                subValue: isShare ? `${fmt.number(pointData.val)} ${tpdUnit}` : fmt.percent(pointData.share),
                color,
              }),
              footer: ({ dataIndex }) => ({
                label: t.common.total,
                value: `${fmt.number(regions.total[dataIndex])} ${tpdUnit}`,
                color: 'default',
              }),
            },
            xAxis: {
              type: 'category',
              data: regions.months,
              boundaryGap: false,
            },
            yAxis: {
              type: 'value',
              name: isShare ? '%' : tpdUnit,
              min: 0,
              max: isShare ? 100 : undefined,
            },
            series: regions.series.map(({ code, values: valList, shares: shareList }) => ({
              name: fmt.region(code),
              type: 'line',
              stack: 'regions',
              areaStyle: { opacity: 0.5 },
              lineStyle: { width: 2 },
              showSymbol: false,
              color: fmt.regionColor(code),
              data: zipRecords({
                value: isShare ? shareList : valList,
                val: valList,
                share: shareList,
              }),
            })),
          }),
        ),
      };
    },
  };
};
