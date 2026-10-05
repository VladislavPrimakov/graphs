import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { themeColors } from '@/styles/tokens';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Ukraine Foreign Trade Structure (Exports vs Imports Balance) chart. */
export const tradeStructureSection: SectionBuilder<'ukraine', typeof dict> = ({ data, t, fmt }) => {
  const tradeColors = themeColors.trade;
  const minTradeYear = Math.min(...data.trade.years);
  const maxTradeYear = Math.max(...data.trade.years);
  const defaultTradeStart = Math.min(maxTradeYear, Math.max(minTradeYear, 2021));
  const defaultTradeEnd = maxTradeYear;
  const tradeYearsStr = data.trade.years.map(String);

  return chartSection({
    id: 'trade-structure',
    title: t.proj.tradeStructure.title,
    controls: [
      {
        id: 'years',
        type: 'range-slider',
        min: minTradeYear,
        max: maxTradeYear,
        defaultValue: [defaultTradeStart, defaultTradeEnd],
        label: t.common.period,
      },
    ],
    buildView: (values) => {
      const [startYear, endYear] = values.years;
      const startIdx = data.trade.years.indexOf(startYear);
      const endIdx = data.trade.years.indexOf(endYear) + 1;

      return chartOption({
        title: { text: t.proj.tradeStructure.title },
        tooltip: { show: false },
        xAxis: {
          type: 'category',
          data: tradeYearsStr.slice(startIdx, endIdx),
        },
        yAxis: {
          type: 'value',
          name: `${fmt.scale(1e9)} ($)`,
        },
        series: [
          createBarSeries({
            id: 'exports',
            name: t.proj.tradeStructure.exports,
            color: tradeColors.exportTotal,
            data: data.trade.totalExports.slice(startIdx, endIdx),
            label: {
              position: 'top',
              color: tradeColors.exportTotal,
            },
            formatLabel: ({ value }) => fmt.number(value),
          }),
          createBarSeries({
            id: 'imports',
            name: t.proj.tradeStructure.imports,
            color: tradeColors.importTotal,
            data: data.trade.totalImports.slice(startIdx, endIdx),
            label: {
              position: 'top',
              color: tradeColors.importTotal,
            },
            formatLabel: ({ value }) => fmt.number(value),
          }),
          {
            id: 'balance',
            name: t.common.balance,
            type: 'line',
            color: tradeColors.balanceLine,
            symbolSize: 12,
            lineStyle: { width: 3, type: 'dashed' },
            data: data.trade.tradeBalance.slice(startIdx, endIdx),
            label: {
              show: true,
              position: 'bottom',
              distance: 8,
              fontSize: 12,
              formatter: (params: CallbackDataParams) => {
                const num = Number(params.value);
                return `${num > 0 ? '+' : ''}${fmt.number(num)}`;
              },
            },
          },
        ],
      });
    },
  });
};
