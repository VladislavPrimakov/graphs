import type { TradePartnersSectionData } from '@graphs/types/ukraine/trade-partners';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Sovereign Partners chart. */
export const tradePartnersSection: SectionBuilder<TradePartnersSectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    sources: [{ name: 'NBU — Merchandise Trade by Partner Nation (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    controls: (data) =>
      [
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
          min: 3,
          max: Math.min(15, Math.max(3, ...data.exports.map((e) => e.length), ...data.imports.map((i) => i.length))),
          defaultValue: 7,
          label: t.common.top,
        },
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
      const count = values.count;
      const isPercent = values.mode === 'percent';
      const [startYear, endYear] = values.years;
      const showLabels = values.labels;
      const tradeYearsStr = data.years.map(String);

      const startIdx = Math.max(0, data.years.indexOf(startYear));
      const endIdx = data.years.indexOf(endYear) !== -1 ? data.years.indexOf(endYear) + 1 : data.years.length;

      const visibleYears = data.years.slice(startIdx, endIdx);
      const visibleExports = data.exports.slice(startIdx, endIdx);
      const visibleImports = data.imports.slice(startIdx, endIdx);
      const visibleTotalExports = data.totalExports.slice(startIdx, endIdx);
      const visibleTotalImports = data.totalImports.slice(startIdx, endIdx);
      const visibleTradeBalance = visibleTotalExports.map((exp, i) => exp - (visibleTotalImports[i] || 0));

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
