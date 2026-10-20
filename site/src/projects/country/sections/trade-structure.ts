import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';
import { tradeColors } from '../tokens';

/** Section builder for Country Foreign Trade Structure (Exports vs Imports Balance) chart. */
export const tradeStructureSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-structure',
    title: t.proj.tradeStructure.title,
    sources: [
      {
        name: 'UN Comtrade — International Trade Statistics Database',
        url: 'https://comtradeplus.un.org/',
      },
    ],
    buildView: ({ country }, stores) => {
      const countryStore = stores.country;
      const data = country.trade;
      const years = country.years;
      const [selStartYear, selEndYear] = countryStore?.period ?? [years[Math.max(0, years.length - 6)], years[years.length - 1]];

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;

      const visibleYears = years.slice(startIdx, endIdx);
      const visibleBalances = data.netBalanceUsd.slice(startIdx, endIdx);

      return {
        content: createChart(
          chartOption({
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleYears[dataIndex]}`,
              row: ({ seriesName, value, data: rowData }) => {
                const item = rowData as { goods?: number | null; services?: number | null };
                const details: string[] = [];
                if (item?.goods != null) details.push(`${t.proj.tradeStructure.goods}: $${fmt.number(item.goods)}`);
                if (item?.services != null) details.push(`${t.proj.tradeStructure.services}: $${fmt.number(item.services)}`);
                const subValue = details.length > 0 ? details.join(' · ') : undefined;
                return {
                  label: seriesName,
                  value: fmt.number(value),
                  subValue,
                };
              },
              footer: ({ dataIndex }) => {
                const bal = visibleBalances[dataIndex];
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
              data: visibleYears.map(String),
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
                data: zipRecords({
                  value: data.totalExportsUsd.slice(startIdx, endIdx),
                  goods: data.goodsExportsUsd.slice(startIdx, endIdx),
                  services: data.servicesExportsUsd.slice(startIdx, endIdx),
                }),
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
                data: zipRecords({
                  value: data.totalImportsUsd.slice(startIdx, endIdx),
                  goods: data.goodsImportsUsd.slice(startIdx, endIdx),
                  services: data.servicesImportsUsd.slice(startIdx, endIdx),
                }),
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
                data: visibleBalances,
                label: {
                  show: true,
                  position: 'bottom',
                  distance: 8,
                  fontSize: 12,
                  formatter: (params: CallbackDataParams) => {
                    const num = Number(params.value);
                    if (Number.isNaN(num)) return '';
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
