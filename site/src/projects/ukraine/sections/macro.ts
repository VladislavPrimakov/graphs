import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, createStackTotalSeries, resolveVisiblePeriod, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';
import { budgetColors } from '../tokens';

/** Section builder for Ukraine State Budget and External Debt (Macro) chart. */
export const macroSection: Section = ({ t, fmt, tokens }) => {
  const formatBudgetLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)})` : fmt.number(val));
  const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)} ${t.proj.macro.gdp})` : fmt.number(val));

  return {
    id: 'macro',
    title: t.proj.macro.title,
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
    buildView: ({ ukraineData }, { ukraineStore }) => {
      const data = ukraineData.macro;
      const budgetXAxisData = data.yearLabels.map((label, i) => {
        const rate = data.rates[i];
        const bal = data.balances[i];
        const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
        const balTag = bal < 0 ? 'balNeg' : 'balPos';

        return `{year|${label}}\n{rate|(${t.proj.macro.fxRate}: ${fmt.number(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})}\n{${balTag}|${t.common.balance}: ${balSign}}`;
      });

      const showLabels = ukraineStore.labels;
      const { startIdx, endIdx } = resolveVisiblePeriod(data.years, ukraineStore.years, {
        seriesData: [data.defense, data.otherExp, data.totalExp, data.domesticRev, data.grants, data.loans, data.totalRevFin, data.govDebt, data.privateDebt, data.debt, data.gdp, data.balances],
      });

      const visibleYearLabels = data.yearLabels.slice(startIdx, endIdx);
      const visibleBalances = data.balances.slice(startIdx, endIdx);
      const visibleLoans = data.loans.slice(startIdx, endIdx).map((v) => (v > 0 ? v : null));
      const visibleLoansPct = data.loansPct.slice(startIdx, endIdx).map((v, idx) => (visibleLoans[idx] != null ? Math.max(0, v) : null));

      return {
        content: createChart(
          chartOption({
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleYearLabels[dataIndex]}`,
              row: ({ seriesName, value, data: rowData }) => {
                const item = rowData as { share?: number; gdpPct?: number | null };
                const subValue = item?.share != null ? fmt.percent(item.share) : item?.gdpPct != null ? `${fmt.percent(item.gdpPct)} ${t.proj.macro.gdp}` : undefined;
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
                name: t.proj.macro.defenseSpending,
                stack: 'expenditures',
                data: zipRecords({
                  value: data.defense.slice(startIdx, endIdx),
                  share: data.defensePct.slice(startIdx, endIdx),
                }),
                color: budgetColors.defense,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'other_exp',
                name: t.proj.macro.nonDefenseSpending,
                stack: 'expenditures',
                data: zipRecords({
                  value: data.otherExp.slice(startIdx, endIdx),
                  share: data.otherExpPct.slice(startIdx, endIdx),
                }),
                color: budgetColors.otherExp,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createStackTotalSeries({
                stack: 'expenditures',
                data: zipRecords({
                  value: data.totalExp.slice(startIdx, endIdx),
                  gdpPct: data.expGdpPct.slice(startIdx, endIdx),
                }),
                label: { show: showLabels },
                formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
              }),
              createBarSeries({
                id: 'domestic_rev',
                name: t.proj.macro.domesticRevenues,
                stack: 'revenues',
                data: zipRecords({
                  value: data.domesticRev.slice(startIdx, endIdx),
                  share: data.domesticRevPct.slice(startIdx, endIdx),
                }),
                color: budgetColors.domesticRev,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'grants',
                name: t.proj.macro.grants,
                stack: 'revenues',
                data: zipRecords({
                  value: data.grants.slice(startIdx, endIdx),
                  share: data.grantsPct.slice(startIdx, endIdx),
                }),
                color: budgetColors.grants,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'loans',
                name: t.proj.macro.loans,
                stack: 'revenues',
                data: zipRecords({
                  value: visibleLoans,
                  share: visibleLoansPct,
                }),
                color: budgetColors.loans,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createStackTotalSeries({
                stack: 'revenues',
                data: zipRecords({
                  value: data.totalRevFin.slice(startIdx, endIdx),
                  gdpPct: data.revGdpPct.slice(startIdx, endIdx),
                }),
                label: { show: showLabels },
                formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
              }),
              createBarSeries({
                id: 'gov_debt',
                name: t.proj.macro.govDebt,
                stack: 'debt',
                data: zipRecords({
                  value: data.govDebt.slice(startIdx, endIdx),
                  share: data.govDebtPct.slice(startIdx, endIdx),
                }),
                color: budgetColors.govDebt,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'private_debt',
                name: t.proj.macro.privateDebt,
                stack: 'debt',
                data: zipRecords({
                  value: data.privateDebt.slice(startIdx, endIdx),
                  share: data.privateDebtPct.slice(startIdx, endIdx),
                }),
                color: budgetColors.privateDebt,
                label: { show: showLabels },
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createStackTotalSeries({
                stack: 'debt',
                data: zipRecords({
                  value: data.debt.slice(startIdx, endIdx),
                  gdpPct: data.debtGdpPct.slice(startIdx, endIdx),
                }),
                label: { show: showLabels },
                formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
              }),
              createBarSeries({
                id: 'gdp',
                name: t.proj.macro.nominalGdp,
                data: data.gdp.slice(startIdx, endIdx),
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
