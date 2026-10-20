import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, resolveEffectiveMax, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';
import { budgetColors } from '../tokens';

/** Section builder for Ukraine Macroeconomic Growth Dynamics (YoY in USD) chart. */
export const macroGrowthSection: Section = ({ t, fmt, tokens }) => {
  return {
    id: 'macro-growth',
    title: t.proj.macroGrowth.title,
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
    buildView: ({ ukraine: dataset }, { ukraine }) => {
      const data = dataset['macro-growth'];
      const [selStartYear, selEndYear] = ukraine?.years ?? [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]];
      const foundStartIdx = data.years.findIndex((y) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = data.years.findLastIndex((y) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? data.years.length : foundEndIdx + 1;

      const visibleYears = data.years.slice(startIdx, endIdx);

      const visibleSeries = [
        data.gdpYoy.slice(startIdx, endIdx),
        data.realGdpYoy.slice(startIdx, endIdx),
        data.domesticRevYoy.slice(startIdx, endIdx),
        data.totalExpYoy.slice(startIdx, endIdx),
        data.govDebtYoy.slice(startIdx, endIdx),
      ];
      const yMax = resolveEffectiveMax(visibleSeries, { ratio: 2.5, headroom: 1.15, roundStep: 20 });

      const series: LineSeriesOption[] = [
        {
          id: 'gdp',
          name: t.proj.macroGrowth.gdp,
          type: 'line',
          color: budgetColors.gdp,
          data: zipRecords({
            value: data.gdpYoy.slice(startIdx, endIdx),
            diff: data.gdpDiff.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.gdpShort,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: {
              type: 'dashed',
              color: tokens.border.muted,
              width: 1,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          id: 'real_gdp',
          name: t.proj.macroGrowth.realGdp,
          type: 'line',
          color: budgetColors.gdp,
          lineStyle: { type: 'dashed', width: 2 },
          data: data.realGdpYoy.slice(startIdx, endIdx),
          endLabel: {
            formatter: () => t.proj.macroGrowth.realGdpShort,
          },
        },
        {
          id: 'domestic_rev',
          name: t.proj.macroGrowth.domesticRev,
          type: 'line',
          color: budgetColors.domesticRev,
          data: zipRecords({
            value: data.domesticRevYoy.slice(startIdx, endIdx),
            diff: data.domesticRevDiff.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.domesticRevShort,
          },
        },
        {
          id: 'total_exp',
          name: t.proj.macroGrowth.totalExp,
          type: 'line',
          color: budgetColors.totalExp,
          data: zipRecords({
            value: data.totalExpYoy.slice(startIdx, endIdx),
            diff: data.totalExpDiff.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.totalExpShort,
          },
        },
        {
          id: 'gov_debt',
          name: t.proj.macroGrowth.govDebt,
          type: 'line',
          color: budgetColors.govDebt,
          data: zipRecords({
            value: data.govDebtYoy.slice(startIdx, endIdx),
            diff: data.govDebtDiff.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.govDebtShort,
          },
        },
      ];

      return {
        content: createChart(
          chartOption({
            legend: { show: false },
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => `${t.common.period}: ${visibleYears[dataIndex]}`,
              sort: 'desc',
              row: ({ seriesName, value, data: rowData }) => {
                const item = typeof rowData === 'object' && rowData !== null ? (rowData as { diff?: number | null }) : undefined;
                const sign = value > 0 ? '+' : '';
                const diffSign = item?.diff != null && item.diff > 0 ? '+' : item?.diff != null && item.diff < 0 ? '-' : '';
                const subValue = item?.diff != null ? `${diffSign}$${fmt.number(Math.abs(item.diff), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${fmt.scale(1e9)}` : undefined;
                return {
                  label: seriesName,
                  value: `${sign}${fmt.percent(value)}`,
                  subValue,
                };
              },
            },
            xAxis: {
              type: 'category',
              data: visibleYears.map(String),
            },
            yAxis: {
              type: 'value',
              name: '%',
              max: yMax,
            },
            series,
          }),
        ),
      };
    },
  };
};
