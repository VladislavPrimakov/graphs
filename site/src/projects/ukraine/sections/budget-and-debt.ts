import { themeColors } from '@/styles/tokens';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries, createStackTotalSeries, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Ukraine State Budget and External Debt chart. */
export const budgetAndDebtSection: SectionBuilder<'ukraine', typeof dict> = ({ data, t, fmt }) => {
  const budgetColors = themeColors.budget;
  const minBudgetYear = Math.min(...data.budgetDebt.years);
  const maxBudgetYear = Math.max(...data.budgetDebt.years);
  const defaultBudgetStart = Math.min(maxBudgetYear, Math.max(minBudgetYear, 2021));
  const defaultBudgetEnd = maxBudgetYear;

  const formatBudgetLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)})` : fmt.number(val));
  const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)} ${t.proj.budgetAndDebt.gdp})` : fmt.number(val));

  const budgetXAxisData = data.budgetDebt.yearLabels.map((label, i) => {
    const rate = data.budgetDebt.rates[i];
    const bal = data.budgetDebt.balances[i];
    const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
    const balTag = bal < 0 ? 'balNeg' : 'balPos';

    return `{year|${label}}\n{rate|(${t.proj.budgetAndDebt.fxRate}: ${fmt.number(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})}\n{${balTag}|${t.common.balance}: ${balSign}}`;
  });

  return chartSection({
    id: 'budget-and-debt',
    title: t.proj.budgetAndDebt.title,
    controls: [
      {
        id: 'labels',
        type: 'checkbox',
        defaultValue: true,
        label: t.common.labels,
      },
      {
        id: 'years',
        type: 'range-slider',
        min: minBudgetYear,
        max: maxBudgetYear,
        defaultValue: [defaultBudgetStart, defaultBudgetEnd],
        label: t.common.period,
      },
    ],
    buildView: (values) => {
      const [startYear, endYear] = values.years;
      const showLabels = values.labels;
      const startIdx = data.budgetDebt.years.indexOf(startYear);
      const endIdx = data.budgetDebt.years.indexOf(endYear) + 1;

      const visibleYearLabels = data.budgetDebt.yearLabels.slice(startIdx, endIdx);
      const visibleBalances = data.budgetDebt.balances.slice(startIdx, endIdx);

      return chartOption({
        title: { text: t.proj.budgetAndDebt.title },
        tooltip: {
          type: 'axis',
          header: ({ dataIndex }) => `${t.common.period}: ${visibleYearLabels[dataIndex]}`,
          row: ({ seriesName, value, data: rowData }) => {
            const item = rowData as { share?: number; gdpPct?: number | null };
            const subValue = item?.share != null ? fmt.percent(item.share) : item?.gdpPct != null ? `${fmt.percent(item.gdpPct)} ${t.proj.budgetAndDebt.gdp}` : undefined;
            return {
              label: seriesName,
              value: fmt.number(value),
              subValue,
            };
          },
          footer: ({ dataIndex }) => {
            const bal = visibleBalances[dataIndex];
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
          data: budgetXAxisData.slice(startIdx, endIdx),
          axisLabel: {
            interval: 0,
            rich: {
              year: { fontWeight: 'bold', lineHeight: 18, color: '#e2e8f0' },
              rate: { fontSize: 10, lineHeight: 14, color: '#94a3b8' },
              balNeg: { fontSize: 10, lineHeight: 14, color: '#f87171' },
              balPos: { fontSize: 10, lineHeight: 14, color: '#4ade80' },
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
            id: 'defense',
            name: t.proj.budgetAndDebt.defenseSpending,
            stack: 'expenditures',
            data: zipRecords({
              value: data.budgetDebt.defense.slice(startIdx, endIdx),
              share: data.budgetDebt.defensePct.slice(startIdx, endIdx),
            }),
            color: budgetColors.defense,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createBarSeries({
            id: 'other_exp',
            name: t.proj.budgetAndDebt.nonDefenseSpending,
            stack: 'expenditures',
            data: zipRecords({
              value: data.budgetDebt.otherExp.slice(startIdx, endIdx),
              share: data.budgetDebt.otherExpPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.otherExp,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createStackTotalSeries({
            stack: 'expenditures',
            data: zipRecords({
              value: data.budgetDebt.totalExp.slice(startIdx, endIdx),
              gdpPct: data.budgetDebt.expGdpPct.slice(startIdx, endIdx),
            }),
            label: { show: showLabels, position: 'top' },
            formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
          }),
          createBarSeries({
            id: 'domestic_rev',
            name: t.proj.budgetAndDebt.domesticRevenues,
            stack: 'revenues',
            data: zipRecords({
              value: data.budgetDebt.domesticRev.slice(startIdx, endIdx),
              share: data.budgetDebt.domesticRevPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.domesticRev,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createBarSeries({
            id: 'grants',
            name: t.proj.budgetAndDebt.grants,
            stack: 'revenues',
            data: zipRecords({
              value: data.budgetDebt.grants.slice(startIdx, endIdx),
              share: data.budgetDebt.grantsPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.grants,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createBarSeries({
            id: 'loans',
            name: t.proj.budgetAndDebt.loans,
            stack: 'revenues',
            data: zipRecords({
              value: data.budgetDebt.loans.slice(startIdx, endIdx).map((v) => Math.max(0, v)),
              share: data.budgetDebt.loansPct.slice(startIdx, endIdx).map((v) => Math.max(0, v)),
            }),
            color: budgetColors.loans,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createStackTotalSeries({
            stack: 'revenues',
            data: zipRecords({
              value: data.budgetDebt.totalRevFin.slice(startIdx, endIdx),
              gdpPct: data.budgetDebt.revGdpPct.slice(startIdx, endIdx),
            }),
            label: { show: showLabels, position: 'top' },
            formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
          }),
          createBarSeries({
            id: 'debt',
            name: t.proj.budgetAndDebt.externalDebt,
            data: zipRecords({
              value: data.budgetDebt.debt.slice(startIdx, endIdx),
              gdpPct: data.budgetDebt.debtGdpPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.debt,
            label: { show: showLabels, position: 'top' },
            formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
          }),
          createBarSeries({
            id: 'gdp',
            name: t.proj.budgetAndDebt.nominalGdp,
            data: data.budgetDebt.gdp.slice(startIdx, endIdx),
            color: budgetColors.gdp,
            label: { show: showLabels, position: 'top' },
            formatLabel: ({ value }) => fmt.number(value),
          }),
        ],
      });
    },
  });
};
