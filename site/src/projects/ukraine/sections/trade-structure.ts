import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { Section } from '../project';
import { tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Structure (Exports vs Imports Balance) chart. */
export const tradeStructureSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-structure',
    title: t.proj.tradeStructure.title,
    sources: [
      { name: 'NBU — Merchandise Trade Balance (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' },
      { name: 'NBU — Monthly Foreign Trade (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_m.xlsx' },
    ],
    buildView: ({ ukraine: dataset }, { ukraine }) => {
      const data = dataset['trade-structure'];
      const tradeYearsStr = data.yearLabels;
      const [selStartYear, selEndYear] = ukraine?.years ?? [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]];

      const foundStartIdx = data.years.findIndex((y) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = data.years.findLastIndex((y) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? data.years.length : foundEndIdx + 1;

      return {
        content: createChart(
          chartOption({
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
          }),
        ),
      };
    },
  };
};
