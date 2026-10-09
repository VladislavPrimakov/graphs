import type { BudgetDebtSectionData } from '@graphs/types/ukraine/budget-and-debt';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries, createStackTotalSeries, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { budgetColors } from '../tokens';

/** Section builder for Ukraine State Budget and External Debt chart. */
export const budgetAndDebtSection: SectionBuilder<BudgetDebtSectionData, typeof dict> = ({ t, fmt, tokens }) => {
  const formatBudgetLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)})` : fmt.number(val));
  const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)} ${t.proj.budgetAndDebt.gdp})` : fmt.number(val));

  return chartSection({
    id: 'budget-and-debt',
    title: t.proj.budgetAndDebt.title,
    sources: [
      {
        name: 'NBU — State Budget Execution (xlsx)',
        url: 'https://bank.gov.ua/files/macro/C_budget_m.xlsx',
      },
      {
        name: 'NBU — Gross External Debt (xlsx)',
        url: 'https://bank.gov.ua/files/ES/ZB_q_UAH.xlsx',
      },
      {
        name: 'NBU — Nominal GDP (xlsx)',
        url: 'https://bank.gov.ua/files/macro/GDP_y.xlsx',
      },
    ],
    controls: (data) =>
      [
        {
          id: 'labels',
          type: 'checkbox',
          defaultValue: true,
          label: t.common.labels,
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
      const budgetXAxisData = data.yearLabels.map((label, i) => {
        const rate = data.rates[i];
        const bal = data.balances[i];
        const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
        const balTag = bal < 0 ? 'balNeg' : 'balPos';

        return `{year|${label}}\n{rate|(${t.proj.budgetAndDebt.fxRate}: ${fmt.number(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})}\n{${balTag}|${t.common.balance}: ${balSign}}`;
      });

      const [startYear, endYear] = values.years;
      const showLabels = values.labels;
      const startIdx = Math.max(0, data.years.indexOf(startYear));
      const endIdx = data.years.indexOf(endYear) !== -1 ? data.years.indexOf(endYear) + 1 : data.years.length;

      const visibleYearLabels = data.yearLabels.slice(startIdx, endIdx);
      const visibleBalances = data.balances.slice(startIdx, endIdx);

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
              year: { color: tokens.text.secondary },
              rate: { color: tokens.text.muted },
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
            id: 'defense',
            name: t.proj.budgetAndDebt.defenseSpending,
            stack: 'expenditures',
            data: zipRecords({
              value: data.defense.slice(startIdx, endIdx),
              share: data.defensePct.slice(startIdx, endIdx),
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
              value: data.otherExp.slice(startIdx, endIdx),
              share: data.otherExpPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.otherExp,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createStackTotalSeries({
            stack: 'expenditures',
            data: zipRecords({
              value: data.totalExp.slice(startIdx, endIdx),
              gdpPct: data.expGdpPct.slice(startIdx, endIdx),
            }),
            label: { show: showLabels, position: 'top' },
            formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
            hideOverlap: false,
          }),
          createBarSeries({
            id: 'domestic_rev',
            name: t.proj.budgetAndDebt.domesticRevenues,
            stack: 'revenues',
            data: zipRecords({
              value: data.domesticRev.slice(startIdx, endIdx),
              share: data.domesticRevPct.slice(startIdx, endIdx),
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
              value: data.grants.slice(startIdx, endIdx),
              share: data.grantsPct.slice(startIdx, endIdx),
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
              value: data.loans.slice(startIdx, endIdx).map((v) => Math.max(0, v)),
              share: data.loansPct.slice(startIdx, endIdx).map((v) => Math.max(0, v)),
            }),
            color: budgetColors.loans,
            label: { show: showLabels, position: 'inside' },
            formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
          }),
          createStackTotalSeries({
            stack: 'revenues',
            data: zipRecords({
              value: data.totalRevFin.slice(startIdx, endIdx),
              gdpPct: data.revGdpPct.slice(startIdx, endIdx),
            }),
            label: { show: showLabels, position: 'top' },
            formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
            hideOverlap: false,
          }),
          createBarSeries({
            id: 'debt',
            name: t.proj.budgetAndDebt.externalDebt,
            data: zipRecords({
              value: data.debt.slice(startIdx, endIdx),
              gdpPct: data.debtGdpPct.slice(startIdx, endIdx),
            }),
            color: budgetColors.debt,
            label: { show: showLabels, position: 'top' },
            formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
            hideOverlap: false,
          }),
          createBarSeries({
            id: 'gdp',
            name: t.proj.budgetAndDebt.nominalGdp,
            data: data.gdp.slice(startIdx, endIdx),
            color: budgetColors.gdp,
            label: { show: showLabels, position: 'top' },
            formatLabel: ({ value }) => fmt.number(value),
            hideOverlap: false,
          }),
        ],
      });
    },
  });
};
