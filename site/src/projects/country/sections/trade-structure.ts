import { round } from '@graphs/shared/math';
import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
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
    buildView: ({ countryData, deflator }, { countryStore }) => {
      const countryName = fmt.region(countryData.code);
      const title = `${countryName} — ${t.proj.tradeStructure.title}`;
      const useConst = Boolean(countryStore.inConstant2021);
      const { startIdx, endIdx } = resolveVisiblePeriod(countryData.years, countryStore.years, {
        seriesData: [countryData.timeline.map((y) => y.exports.total), countryData.timeline.map((y) => y.imports.total)],
      });

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const count = visibleTimeline.length;

      const visibleYears = new Array<number>(count);
      const visibleBalances = new Array<number | null>(count);
      const exportsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);
      const importsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        const k = useConst ? (deflator?.[y.year] ?? 1) : 1;
        visibleYears[i] = y.year;
        visibleBalances[i] = y.netBalanceUsd != null ? round(y.netBalanceUsd * k, 2) : null;
        exportsData[i] = {
          value: y.exports.total != null ? round(y.exports.total * k, 2) : null,
          goods: y.exports.goods != null ? round(y.exports.goods * k, 2) : null,
          services: y.exports.services != null ? round(y.exports.services * k, 2) : null,
        };
        importsData[i] = {
          value: y.imports.total != null ? round(y.imports.total * k, 2) : null,
          goods: y.imports.goods != null ? round(y.imports.goods * k, 2) : null,
          services: y.imports.services != null ? round(y.imports.services * k, 2) : null,
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
              name: `${fmt.scale(BILLIONS_SCALE)} (${useConst ? '2021 $' : '$'})`,
            },
            series: [
              createBarSeries({
                id: 'exports',
                name: t.proj.tradeStructure.exports,
                color: tradeColors.exportTotal,
                data: exportsData,
                label: {
                  show: true,
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
                  show: true,
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
                  show: true,
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
