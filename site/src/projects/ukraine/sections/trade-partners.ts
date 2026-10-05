import { themeColors } from '@/styles/tokens';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Ukraine Foreign Trade Sovereign Partners chart. */
export const tradePartnersSection: SectionBuilder<'ukraine', typeof dict> = ({ data, t, fmt }) => {
  const tradeColors = themeColors.trade;
  const totalTradePartners = Math.max(0, ...data.trade.exports.map((e) => e.length), ...data.trade.imports.map((i) => i.length));
  const minTradeYear = Math.min(...data.trade.years);
  const maxTradeYear = Math.max(...data.trade.years);
  const defaultTradeStart = Math.min(maxTradeYear, Math.max(minTradeYear, 2021));
  const defaultTradeEnd = maxTradeYear;
  const tradeYearsStr = data.trade.years.map(String);

  return chartSection({
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    controls: [
      {
        id: 'labels',
        type: 'checkbox',
        defaultValue: true,
        label: t.common.labels,
      },
      {
        id: 'mode',
        type: 'toggle',
        defaultValue: 'absolute',
        label: t.common.metric,
        options: [
          { value: 'absolute', label: `${fmt.scale(1e9)} ($)` },
          { value: 'percent', label: `${t.common.share} (%)` },
        ],
      },
      {
        id: 'count',
        type: 'slider',
        min: Math.min(3, totalTradePartners),
        max: Math.min(15, totalTradePartners),
        defaultValue: Math.min(7, totalTradePartners),
        label: t.common.top,
      },
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
      const count = values.count;
      const isPercent = values.mode === 'percent';
      const [startYear, endYear] = values.years;
      const showLabels = values.labels;

      const startIdx = data.trade.years.indexOf(startYear);
      const endIdx = data.trade.years.indexOf(endYear) + 1;

      const visibleYears = data.trade.years.slice(startIdx, endIdx);
      const visibleExports = data.trade.exports.slice(startIdx, endIdx);
      const visibleImports = data.trade.imports.slice(startIdx, endIdx);
      const visibleTotalExports = data.trade.totalExports.slice(startIdx, endIdx);
      const visibleTotalImports = data.trade.totalImports.slice(startIdx, endIdx);
      const visibleTradeBalance = data.trade.tradeBalance.slice(startIdx, endIdx);

      const buildTradeSeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const dataset = isExp ? visibleExports : visibleImports;
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';
        const series = [];

        for (let i = 0; i < visibleYears.length; i++) {
          const year = visibleYears[i];
          const yearTop = dataset[i]?.slice(0, count) || [];
          for (const [code, val, share] of yearTop) {
            const localizedName = fmt.region(code);
            series.push(
              createBarSeries({
                id: `${type}-${year}-${code}`,
                name: localizedName,
                stack: 'trade',
                color: fmt.regionColor(code),
                label: {
                  show: true,
                  position: 'inside',
                },
                data: [
                  {
                    value: [i, sign * (isPercent ? share : val)],
                    val,
                    share,
                    code,
                  },
                ],
                formatLabel: ({ value }) => {
                  const absVal = Math.abs(value);
                  const valStr = `${prefix}${isPercent ? fmt.percent(absVal) : fmt.number(absVal)}`;
                  return showLabels ? `${localizedName} ${valStr}` : valStr;
                },
              }),
            );
          }
        }

        return series;
      };

      return chartOption({
        title: { text: `${t.proj.tradePartners.title} (${t.common.top} ${count})` },
        tooltip: {
          type: 'dual',
          header: ({ name }) => `${t.common.period}: ${name}`,
          positive: {
            title: t.common.exports,
            color: tradeColors.exportTotal,
            total: ({ dataIndex }) => fmt.number(visibleTotalExports[dataIndex] || 0),
          },
          negative: {
            title: t.common.imports,
            color: tradeColors.importTotal,
            total: ({ dataIndex }) => fmt.number(visibleTotalImports[dataIndex] || 0),
          },
          row: ({ data: rowData }) => {
            const { val, share } = rowData as { val: number; share: number };
            return {
              value: isPercent ? fmt.percent(share) : fmt.number(val),
              subValue: isPercent ? fmt.number(val) : fmt.percent(share),
            };
          },
          footer: ({ dataIndex }) => {
            const balance = visibleTradeBalance[dataIndex] || 0;
            const sign = balance > 0 ? '+' : '';
            return {
              label: t.common.balance,
              value: `${sign}${fmt.number(balance)}`,
              color: balance < 0 ? 'danger' : 'success',
            };
          },
        },
        legend: {
          show: true,
        },
        xAxis: {
          type: 'category',
          data: tradeYearsStr.slice(startIdx, endIdx),
        },
        yAxis: {
          type: 'value',
          name: isPercent ? '%' : `${fmt.scale(1e9)} ($)`,
          axisLabel: {
            formatter: (val: number) => String(Math.abs(val)),
          },
        },
        series: [...buildTradeSeries('exp'), ...buildTradeSeries('imp')],
      });
    },
  });
};
