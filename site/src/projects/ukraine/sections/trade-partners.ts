import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { Section } from '../project';
import { tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Sovereign Partners chart. */
export const tradePartnersSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    sources: [{ name: 'NBU — Merchandise Trade by Partner Nation (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    toolbars: ({ ukraine: dataset }) => {
      const data = dataset['trade-partners'];
      const volumeByCountry: Record<string, number> = {};
      for (const yearExports of data.exports) {
        for (const [code, val] of yearExports) {
          volumeByCountry[code] = (volumeByCountry[code] || 0) + val;
        }
      }
      for (const yearImports of data.imports) {
        for (const [code, val] of yearImports) {
          volumeByCountry[code] = (volumeByCountry[code] || 0) + val;
        }
      }
      const partnerCodes = Object.keys(volumeByCountry).sort((a, b) => volumeByCountry[b] - volumeByCountry[a]);

      return [
        {
          id: 'partners',
          controls: [
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
              max: 15,
              defaultValue: 7,
              label: t.common.top,
              disabled: (state) => ((state.countries as string[])?.length ?? 0) > 0,
            },
            {
              id: 'countries',
              type: 'multi-search-select',
              placeholder: t.proj.countries,
              emptyLabel: t.proj.noCountriesFound,
              items: partnerCodes.map((code) => ({
                value: code,
                label: fmt.region(code),
                icon: createElement('span', { className: 'font-mono text-[10px] opacity-75' }, code),
              })),
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ ukraine: dataset }, { ukraine, partners }) => {
      const data = dataset['trade-partners'];
      const [selStartYear, selEndYear] = ukraine?.years ?? [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]];
      const showLabels = ukraine?.labels ?? true;
      const isPercent = partners.mode === 'percent';
      const count = partners.count;
      const selectedCountries = partners.countries ?? [];
      const hasSelectedCountries = selectedCountries.length > 0;
      const tradeYearsStr = data.years.map(String);

      const foundStartIdx = data.years.findIndex((y) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = data.years.findLastIndex((y) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? data.years.length : foundEndIdx + 1;

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
          const rawYearList = dataset[i] || [];
          const yearTop = hasSelectedCountries ? rawYearList.filter(([code]) => selectedCountries.includes(code)) : rawYearList.slice(0, count);

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

      return {
        title: hasSelectedCountries ? t.proj.tradePartners.title : `${t.proj.tradePartners.title} (${t.common.top} ${count})`,
        content: createChart(
          chartOption({
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
          }),
        ),
      };
    },
  };
};
