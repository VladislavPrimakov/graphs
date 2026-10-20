import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { Section } from '../project';
import { tradeColors } from '../tokens';

/** Section builder for Country Foreign Trade Leading Bilateral Trading Partners chart. */
export const tradePartnersSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    sources: [
      {
        name: 'UN Comtrade — International Trade Statistics Database',
        url: 'https://comtradeplus.un.org/',
      },
    ],
    toolbars: ({ country }) => {
      const topPartners = country?.partners?.topPartners ?? [];

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
              disabled: (state: Record<string, unknown>) => ((state.countries as string[])?.length ?? 0) > 0,
            },
            {
              id: 'countries',
              type: 'multi-search-select',
              placeholder: t.proj.tradePartners.partners,
              emptyLabel: t.proj.tradePartners.noPartnersFound,
              items: topPartners.map(([code, count]) => ({
                value: code,
                label: fmt.region(code),
                count,
              })),
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ country }, stores) => {
      const countryStore = stores.country;
      const partners = stores.partners;
      const data = country.partners;
      const years = country.years;
      const [selStartYear, selEndYear] = countryStore?.period ?? [years[Math.max(0, years.length - 6)], years[years.length - 1]];
      const showLabels = countryStore?.labels ?? true;
      const isPercent = partners?.mode === 'percent';
      const count = partners?.count ?? 7;
      const selectedCountries = (partners?.countries as string[]) ?? [];
      const hasSelectedCountries = selectedCountries.length > 0;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;

      const visibleYears = years.slice(startIdx, endIdx);
      const visibleExports = (data?.exports || []).slice(startIdx, endIdx);
      const visibleImports = (data?.imports || []).slice(startIdx, endIdx);
      const visibleTotalExports = country.trade.totalExportsUsd.slice(startIdx, endIdx);
      const visibleTotalImports = country.trade.totalImportsUsd.slice(startIdx, endIdx);
      const visibleTradeBalance = visibleTotalExports.map((exp, i) => (exp ?? 0) - (visibleTotalImports[i] ?? 0));

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
              data: visibleYears.map(String),
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
