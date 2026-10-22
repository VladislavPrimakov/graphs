import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import { BALANCE_LINE_WIDTH, BALANCE_SYMBOL_SIZE, BILLIONS_SCALE } from '../constants';
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
    buildView: ({ countryData }, { countryStore }) => {
      const countryName = fmt.region(countryData.code);
      const title = `${countryName} — ${t.proj.tradeStructure.title}`;
      const years = countryData.years;
      const [selStartYear, selEndYear] = countryStore.period;
      const showLabels = countryStore.labels;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? years.length : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? 0 : foundEndIdx + 1;

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const count = visibleTimeline.length;

      const visibleYears = new Array<number>(count);
      const visibleBalances = new Array<number | null>(count);
      const exportsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);
      const importsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        visibleYears[i] = y.year;
        visibleBalances[i] = y.netBalanceUsd;
        exportsData[i] = {
          value: y.exports.total,
          goods: y.exports.goods,
          services: y.exports.services,
        };
        importsData[i] = {
          value: y.imports.total,
          goods: y.imports.goods,
          services: y.imports.services,
        };
      }

      return {
        title,
        content: createChart(
          chartOption({
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleYears[dataIndex]}`,
              row: ({ seriesName, value, seriesId, data: rowData }) => {
                if (seriesId === 'balance') return undefined;
                const item = rowData as { goods?: number | null; services?: number | null };
                const details: string[] = [];
                if (item?.goods != null) details.push(`${t.proj.tradeStructure.goods}: ${fmt.number(item.goods)}`);
                if (item?.services != null) details.push(`${t.proj.tradeStructure.services}: ${fmt.number(item.services)}`);
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
              name: `${fmt.scale(BILLIONS_SCALE)} ($)`,
            },
            series: [
              createBarSeries({
                id: 'exports',
                name: t.proj.tradeStructure.exports,
                color: tradeColors.exportTotal,
                data: exportsData,
                label: {
                  show: showLabels,
                  color: tradeColors.exportTotal,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
              createBarSeries({
                id: 'imports',
                name: t.proj.tradeStructure.imports,
                color: tradeColors.importTotal,
                data: importsData,
                label: {
                  show: showLabels,
                  color: tradeColors.importTotal,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
              {
                id: 'balance',
                name: t.common.balance,
                type: 'line',
                color: tradeColors.balanceLine,
                symbolSize: BALANCE_SYMBOL_SIZE,
                lineStyle: { width: BALANCE_LINE_WIDTH, type: 'dashed' },
                data: visibleBalances,
                label: {
                  show: showLabels,
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
