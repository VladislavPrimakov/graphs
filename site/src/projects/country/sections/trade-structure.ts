import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
import { resolveAdaptiveScale } from '@/utils/scale';
import { BALANCE_LINE_WIDTH, BALANCE_SYMBOL_SIZE } from '../constants';
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
      const showLabels = Boolean(countryStore.labels);
      const useConst = Boolean(countryStore.inConstant2021);
      const { startIdx, endIdx } = resolveVisiblePeriod(countryData.years, countryStore.years, {
        seriesData: [countryData.timeline.map((y) => y.exports.total), countryData.timeline.map((y) => y.imports.total)],
      });

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const count = visibleTimeline.length;

      const visibleYears = new Array<number>(count);
      const exportsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);
      const importsData = new Array<{ value: number | null; goods: number | null; services: number | null }>(count);

      const rawExp = new Array<number | null>(count);
      const rawGoodsExp = new Array<number | null>(count);
      const rawServExp = new Array<number | null>(count);
      const rawImp = new Array<number | null>(count);
      const rawGoodsImp = new Array<number | null>(count);
      const rawServImp = new Array<number | null>(count);
      const rawBal = new Array<number | null>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        const k = useConst ? (deflator?.[y.year] ?? 1) : 1;
        visibleYears[i] = y.year;
        rawBal[i] = y.netBalanceUsd != null ? y.netBalanceUsd * k : null;
        rawExp[i] = y.exports.total != null ? y.exports.total * k : null;
        rawGoodsExp[i] = y.exports.goods != null ? y.exports.goods * k : null;
        rawServExp[i] = y.exports.services != null ? y.exports.services * k : null;
        rawImp[i] = y.imports.total != null ? y.imports.total * k : null;
        rawGoodsImp[i] = y.imports.goods != null ? y.imports.goods * k : null;
        rawServImp[i] = y.imports.services != null ? y.imports.services * k : null;
      }

      const {
        scaleLabel,
        data: [scaledExp, scaledGoodsExp, scaledServExp, scaledImp, scaledGoodsImp, scaledServImp, visibleBalances],
      } = resolveAdaptiveScale([rawExp, rawGoodsExp, rawServExp, rawImp, rawGoodsImp, rawServImp, rawBal], fmt);
      const curr = useConst ? '2021 $' : '$';
      const unit = scaleLabel ? `${scaleLabel} (${curr})` : `(${curr})`;

      for (let i = 0; i < count; i++) {
        exportsData[i] = { value: scaledExp[i], goods: scaledGoodsExp[i], services: scaledServExp[i] };
        importsData[i] = { value: scaledImp[i], goods: scaledGoodsImp[i], services: scaledServImp[i] };
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
              name: unit,
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
