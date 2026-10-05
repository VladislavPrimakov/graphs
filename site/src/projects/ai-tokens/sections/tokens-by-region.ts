import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Daily AI Inference Tokens by Macro-Region chart. */
export const tokensByRegionSection: SectionBuilder<'ai-tokens', typeof dict> = ({ data, t, fmt }) => {
  const { summary, regions } = data;
  const tpdUnit = fmt.per(fmt.scale(1e12), 'duration-day');

  return chartSection({
    id: 'tokens-by-region',
    title: t.proj.tokensByRegion.title,
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
    buildView: (values) => {
      const isShare = values.mode === 'share';
      return chartOption({
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
      });
    },
  });
};
