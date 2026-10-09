import type { TradeStructureSectionData } from '@graphs/types/ukraine/trade-structure';
import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Structure (Exports vs Imports Balance) chart. */
export const tradeStructureSection: SectionBuilder<TradeStructureSectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'trade-structure',
    title: t.proj.tradeStructure.title,
    sources: [{ name: 'NBU — Merchandise Trade Balance (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    controls: (data) =>
      [
        {
          id: 'years',
          type: 'range-slider',
          min: data.years[0],
          max: data.years[data.years.length - 1],
          defaultValue: [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]],
          label: t.common.period,
        },
      ] as const,
    buildView: (data, values) => {
      const tradeYearsStr = data.years.map(String);
      const [startYear, endYear] = values.years;
      const startIdx = Math.max(0, data.years.indexOf(startYear));
      const endIdx = data.years.indexOf(endYear) !== -1 ? data.years.indexOf(endYear) + 1 : data.years.length;

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
            data: data.totalExports.slice(startIdx, endIdx),
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
            data: data.totalImports.slice(startIdx, endIdx),
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
            data: data.tradeBalance.slice(startIdx, endIdx),
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
