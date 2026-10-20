import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';
import { budgetColors } from '../tokens';

/** Section builder for Country State Budget & Sovereign Debt (Macro) chart. */
export const macroSection: Section = ({ t, fmt, tokens }) => {
  const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)} ${t.proj.macro.gdp})` : fmt.number(val));

  return {
    id: 'macro',
    title: t.proj.macro.title,
    sources: [
      {
        name: 'IMF — World Economic Outlook (WEO)',
        url: 'https://www.imf.org/en/Publications/WEO',
      },
    ],
    buildView: ({ country }, stores) => {
      const countryStore = stores.country;
      const data = country.macro;
      const years = country.years;
      const [selStartYear, selEndYear] = countryStore?.period ?? [years[Math.max(0, years.length - 6)], years[years.length - 1]];
      const showLabels = countryStore?.labels ?? true;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;

      const visibleYears = years.slice(startIdx, endIdx);
      const visibleBalances = data.govBalanceUsd.slice(startIdx, endIdx);
      const visibleBalancesPct = data.govBalancePctGdp.slice(startIdx, endIdx);

      const budgetXAxisData = visibleYears.map((year: number, i: number) => {
        const bal = visibleBalances[i];
        if (bal == null) return `{year|${year}}`;
        const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
        const balTag = bal < 0 ? 'balNeg' : 'balPos';
        return `{year|${year}}\n{${balTag}|${balSign}}`;
      });

      return {
        content: createChart(
          chartOption({
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleYears[dataIndex]}`,
              row: ({ seriesName, value, data: rowData }) => {
                const item = rowData as { gdpPct?: number | null };
                const subValue = item?.gdpPct != null ? `${fmt.percent(item.gdpPct)} ${t.proj.macro.gdp}` : undefined;
                return {
                  label: seriesName,
                  value: fmt.number(value),
                  subValue,
                };
              },
              footer: ({ dataIndex }) => {
                const bal = visibleBalances[dataIndex];
                if (bal == null) return undefined;
                const balPct = visibleBalancesPct[dataIndex];
                const sign = bal > 0 ? '+' : '';
                const pctStr = balPct != null ? ` (${sign}${fmt.percent(balPct)} ${t.proj.macro.gdp})` : '';
                return {
                  label: t.proj.macro.balance,
                  value: `${sign}${fmt.number(bal)}${pctStr}`,
                  color: bal < 0 ? 'danger' : 'success',
                };
              },
            },
            xAxis: {
              type: 'category',
              data: budgetXAxisData,
              axisLabel: {
                interval: 0,
                rich: {
                  year: { color: tokens.text.secondary },
                  balNeg: { color: tokens.status.danger },
                  balPos: { color: tokens.status.success },
                },
              },
            },
            yAxis: {
              type: 'value',
              min: 0,
              name: `${fmt.scale(1e9)} ($)`,
            },
            series: [
              createBarSeries({
                id: 'expenditures',
                name: t.proj.macro.expenditure,
                data: zipRecords({
                  value: data.govExpenditureUsd.slice(startIdx, endIdx),
                  gdpPct: data.govExpenditurePctGdp.slice(startIdx, endIdx),
                }),
                color: budgetColors.totalExp,
                label: { show: showLabels, position: 'top' },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'revenues',
                name: t.proj.macro.revenue,
                data: zipRecords({
                  value: data.govRevenueUsd.slice(startIdx, endIdx),
                  gdpPct: data.govRevenuePctGdp.slice(startIdx, endIdx),
                }),
                color: budgetColors.domesticRev,
                label: { show: showLabels, position: 'top' },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'debt',
                name: t.proj.macro.debt,
                data: zipRecords({
                  value: data.govDebtUsd.slice(startIdx, endIdx),
                  gdpPct: data.govDebtPctGdp.slice(startIdx, endIdx),
                }),
                color: budgetColors.govDebt,
                label: { show: showLabels, position: 'top' },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'gdp',
                name: t.proj.macro.nominalGdp,
                data: data.gdpNominalUsd.slice(startIdx, endIdx),
                color: budgetColors.gdp,
                label: { show: showLabels, position: 'top' },
                formatLabel: ({ value }) => fmt.number(value),
              }),
            ],
          }),
        ),
      };
    },
  };
};
