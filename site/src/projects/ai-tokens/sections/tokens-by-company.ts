import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import { AI_COMPANIES, COMPANY_COLORS } from '../constants';
import type { dict } from '../locales/dict-en';

/** Section builder for Daily AI Inference Tokens by Model Provider chart. */
export const tokensByCompanySection: SectionBuilder<'ai-tokens', typeof dict> = ({ data, t, fmt }) => {
  const { companies } = data;
  const tpdUnit = fmt.per(fmt.scale(1e12), 'duration-day');

  return chartSection({
    id: 'tokens-by-company',
    title: t.proj.tokensByCompany.title,
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
        title: { text: t.proj.tokensByCompany.title },
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
            value: `${fmt.number(companies.total[dataIndex])} ${tpdUnit}`,
            color: 'default',
          }),
        },
        xAxis: {
          type: 'category',
          data: companies.months,
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          name: isShare ? '%' : tpdUnit,
          min: 0,
          max: isShare ? 100 : undefined,
        },
        series: companies.series.map(({ id, values: valList, shares: shareList }) => ({
          name: AI_COMPANIES[id],
          type: 'line',
          stack: 'companies',
          areaStyle: { opacity: 0.5 },
          lineStyle: { width: 2 },
          showSymbol: false,
          color: COMPANY_COLORS[id] || '#94a3b8',
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
