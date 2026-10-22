import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import { BILLIONS_SCALE } from '../constants';
import type { Section } from '../project';
import { budgetColors } from '../tokens';

/** Section builder for Country State Budget & Sovereign Debt (Macro) chart. */
export const macroSection: Section = ({ t, fmt, tokens }) => {
  const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)})` : fmt.number(val));

  return {
    id: 'macro',
    title: t.proj.macro.title,
    sources: [
      {
        name: 'IMF — World Economic Outlook (WEO)',
        url: 'https://www.imf.org/en/Publications/WEO',
      },
    ],
    buildView: ({ countryData }, { countryStore }) => {
      const countryName = fmt.region(countryData.code);
      const title = `${countryName} — ${t.proj.macro.title}`;
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
      const visibleBalancesPct = new Array<number | null>(count);
      const expendituresData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const revenuesData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const debtData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const gdpData = new Array<number | null>(count);
      const budgetXAxisData = new Array<string>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        const m = y.macro;
        const yr = y.year;
        const bal = m.govBalanceUsd;

        visibleYears[i] = yr;
        visibleBalances[i] = bal;
        visibleBalancesPct[i] = m.govBalancePctGdp;
        expendituresData[i] = { value: m.govExpenditureUsd, gdpPct: m.govExpenditurePctGdp };
        revenuesData[i] = { value: m.govRevenueUsd, gdpPct: m.govRevenuePctGdp };
        debtData[i] = { value: m.govDebtUsd, gdpPct: m.govDebtPctGdp };
        gdpData[i] = m.gdpNominalUsd;

        if (bal == null) {
          budgetXAxisData[i] = `{year|${yr}}`;
        } else {
          const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
          const balTag = bal < 0 ? 'balNeg' : 'balPos';
          budgetXAxisData[i] = `{year|${yr}}\n{${balTag}|${balSign}}`;
        }
      }

      return {
        title,
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
                interval: visibleYears.length > 15 ? 'auto' : 0,
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
              name: `${fmt.scale(BILLIONS_SCALE)} ($)`,
            },
            series: [
              createBarSeries({
                id: 'expenditures',
                name: t.proj.macro.expenditure,
                data: expendituresData,
                color: budgetColors.totalExp,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'revenues',
                name: t.proj.macro.revenue,
                data: revenuesData,
                color: budgetColors.domesticRev,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'debt',
                name: t.proj.macro.debt,
                data: debtData,
                color: budgetColors.govDebt,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'gdp',
                name: t.proj.macro.nominalGdp,
                data: gdpData,
                color: budgetColors.gdp,
                label: { show: showLabels },
                formatLabel: ({ value }) => fmt.number(value),
              }),
            ],
          }),
        ),
      };
    },
  };
};
