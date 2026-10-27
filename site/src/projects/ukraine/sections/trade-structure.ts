import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
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
    buildView: ({ ukraineData }, { ukraineStore }) => {
      const data = ukraineData['trade-structure'];
      const { startIdx, endIdx } = resolveVisiblePeriod(data.years, ukraineStore.years, {
        seriesData: [data.totalExports, data.totalImports, data.tradeBalance],
      });
      const tradeYearsStr = data.yearLabels;

      return {
        content: createChart(
          chartOption({
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${tradeYearsStr.slice(startIdx, endIdx)[dataIndex]}`,
              row: ({ seriesName, value, seriesId }) => {
                if (seriesId === 'balance') return undefined;
                return {
                  label: seriesName,
                  value: fmt.number(value),
                };
              },
              footer: ({ dataIndex }) => {
                const bal = data.tradeBalance.slice(startIdx, endIdx)[dataIndex];
                if (bal == null) return undefined;
                const sign = bal > 0 ? '+' : '';
                return {
                  label: t.common.balance,
                  value: `${sign}${fmt.number(bal)}`,
                  color: bal < 0 ? 'danger' : 'success',
                };
              },
            },
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
