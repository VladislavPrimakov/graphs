import type React from 'react';
import type { BarSeriesOption, EChartsOption, UaBudgetDebtData } from '@/types';
import { themeColors } from '../../styles/tokens';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the Ukraine budget, debt, and GDP multi-column bar graph. */
export interface UaEconomicBudgetDebtGraphProps {
  /** Annual state budget execution and sovereign debt indicators dataset. */
  budget_debt: UaBudgetDebtData;
}

/** Multi-column grouped and stacked bar chart visualizing Ukraine's state budget execution, foreign financing, debt, and GDP share (Billion USD). */
export const UaEconomicBudgetDebtGraph: React.FC<UaEconomicBudgetDebtGraphProps> = ({ budget_debt }) => {
  const minSegmentValue = 1.5;
  const budgetColors = themeColors.budget;

  const formatSegment = (val: number, pct?: number | null) => {
    if (val <= minSegmentValue) return '';
    return pct !== undefined && pct !== null ? `${val.toFixed(1)}\n(${pct}%)` : `${val.toFixed(1)}`;
  };

  const formatWithGdp = (val: number, gdpPct?: number | null) => {
    return gdpPct ? `${val.toFixed(1)}\n(${gdpPct}% GDP)` : `${val.toFixed(1)}`;
  };

  const xAxisData = budget_debt.years.map((_: number, idx: number) => {
    const yLabel = budget_debt.year_labels[idx];
    const rate = budget_debt.rates[idx];
    const bal = budget_debt.balances[idx];
    const balSign = `${bal > 0 ? '+' : ''}${bal.toFixed(1)}`;
    const balTag = bal < 0 ? 'balNeg' : 'balPos';
    return `{year|${yLabel}}\n{rate|(FX: ${rate.toFixed(2)})}\n{${balTag}|Balance: ${balSign}}`;
  });

  function createBudgetSegment({
    name,
    stack,
    values,
    percentages,
    color,
    borderRadius,
  }: {
    name: string;
    stack?: string;
    values: number[];
    percentages?: (number | null)[];
    color: string;
    borderRadius?: [number, number, number, number];
  }): BarSeriesOption {
    return {
      name,
      type: 'bar',
      ...(stack ? { stack } : {}),
      data: values.map((val, idx) => {
        const lbl = percentages ? formatSegment(val, percentages[idx]) : '';
        return {
          value: val,
          label: {
            show: Boolean(lbl),
            position: 'inside',
            color: themeColors.text.primary,
            fontSize: 10,
            fontWeight: 'bold',
            lineHeight: 12,
            textBorderColor: themeColors.surface.card,
            textBorderWidth: 2,
            formatter: lbl,
          },
        };
      }),
      itemStyle: {
        color,
        ...(borderRadius ? { borderRadius } : {}),
      },
    };
  }

  function createStackTotalSeries(stack: string, totals: number[], gdpPcts: (number | null)[], color: string): BarSeriesOption {
    return {
      name: `${stack} Total`,
      type: 'bar',
      stack,
      silent: true,
      data: totals.map((tot, idx) => ({
        value: 0,
        label: {
          show: tot > 0,
          position: 'top',
          distance: 5,
          color,
          fontSize: 10,
          fontWeight: 'bold',
          lineHeight: 13,
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
          formatter: formatWithGdp(tot, gdpPcts[idx]),
        },
      })),
      tooltip: { show: false },
    };
  }

  const budgetChartOption: EChartsOption = {
    title: {
      text: 'Comparison of Ukraine State Budget, Gross External Debt and GDP',
    },
    tooltip: {
      show: false,
    },
    legend: {
      data: ['Expenditures: Defense', 'Expenditures: Other', 'Revenues: Domestic Taxes', 'Revenues: External Grants', 'Financing: External Loans', 'Gross External Debt', 'Nominal GDP (annual)'],
    },
    grid: {
      top: 90,
      bottom: '12%',
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        interval: 0,
        rich: {
          year: {
            fontSize: 13,
            fontWeight: 'bold',
            color: themeColors.text.primary,
            lineHeight: 18,
            align: 'center',
          },
          rate: {
            fontSize: 10,
            color: themeColors.text.muted,
            lineHeight: 15,
            align: 'center',
          },
          balNeg: {
            fontSize: 10,
            fontWeight: 'bold',
            color: themeColors.status.danger,
            lineHeight: 15,
            align: 'center',
          },
          balPos: {
            fontSize: 10,
            fontWeight: 'bold',
            color: themeColors.status.success,
            lineHeight: 15,
            align: 'center',
          },
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Billion USD ($)',
      },
    ],
    series: [
      createBudgetSegment({
        name: 'Expenditures: Defense',
        stack: 'Expenditures',
        values: budget_debt.defense,
        percentages: budget_debt.defense_pct,
        color: budgetColors.defense,
      }),
      createBudgetSegment({
        name: 'Expenditures: Other',
        stack: 'Expenditures',
        values: budget_debt.other_exp,
        percentages: budget_debt.other_exp_pct,
        color: budgetColors.otherExp,
        borderRadius: [4, 4, 0, 0],
      }),
      createStackTotalSeries('Expenditures', budget_debt.total_exp, budget_debt.exp_gdp_pct, themeColors.text.primary),
      createBudgetSegment({
        name: 'Revenues: Domestic Taxes',
        stack: 'Revenues',
        values: budget_debt.domestic_rev,
        percentages: budget_debt.domestic_rev_pct,
        color: budgetColors.domesticRev,
      }),
      createBudgetSegment({
        name: 'Revenues: External Grants',
        stack: 'Revenues',
        values: budget_debt.grants,
        percentages: budget_debt.grants_pct,
        color: budgetColors.grants,
      }),
      createBudgetSegment({
        name: 'Financing: External Loans',
        stack: 'Revenues',
        values: budget_debt.loans,
        percentages: budget_debt.loans_pct,
        color: budgetColors.loans,
        borderRadius: [4, 4, 0, 0],
      }),
      createStackTotalSeries('Revenues', budget_debt.total_rev_fin, budget_debt.rev_gdp_pct, themeColors.text.primary),
      {
        name: 'Gross External Debt',
        type: 'bar',
        data: budget_debt.debt.map((val: number, idx: number) => ({
          value: val,
          label: {
            show: true,
            position: 'top',
            distance: 5,
            color: themeColors.text.primary,
            fontSize: 10,
            fontWeight: 'bold',
            lineHeight: 13,
            textBorderColor: themeColors.surface.card,
            textBorderWidth: 2,
            formatter: formatWithGdp(val, budget_debt.debt_gdp_pct[idx]),
          },
        })),
        itemStyle: {
          color: budgetColors.debt,
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Nominal GDP (annual)',
        type: 'bar',
        data: budget_debt.gdp.map((val: number | null) => ({
          value: val,
          label: {
            show: val !== null && val !== undefined,
            position: 'top',
            distance: 5,
            color: themeColors.text.primary,
            fontSize: 10,
            fontWeight: 'bold',
            textBorderColor: themeColors.surface.card,
            textBorderWidth: 2,
            formatter: val ? `${val.toFixed(1)}` : '',
          },
        })),
        itemStyle: {
          color: budgetColors.gdp,
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  return (
    <section data-anchor-section="budget-and-debt" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="budget-and-debt">
        <EChart option={budgetChartOption} height="540px" chartId="chart-ua-budget" />
      </ChartCard>
    </section>
  );
};

export default UaEconomicBudgetDebtGraph;
