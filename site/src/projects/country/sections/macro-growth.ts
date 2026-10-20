import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, resolveEffectiveMax, zipRecords } from '@/utils/chart-builder';
import type { Section } from '../project';
import { budgetColors } from '../tokens';

/** Section builder for Country Macroeconomic Growth Dynamics (YoY in USD) chart. */
export const macroGrowthSection: Section = ({ t, fmt, tokens }) => {
  return {
    id: 'macro-growth',
    title: t.proj.macroGrowth.title,
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

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;

      const visibleYears = years.slice(startIdx, endIdx);

      const visibleSeries = [
        data.growth.gdpYoy.slice(startIdx, endIdx),
        data.gdpRealGrowthYoy.slice(startIdx, endIdx),
        data.growth.revenueYoy.slice(startIdx, endIdx),
        data.growth.expenditureYoy.slice(startIdx, endIdx),
        data.growth.debtYoy.slice(startIdx, endIdx),
      ];
      const yMax = resolveEffectiveMax(visibleSeries, { ratio: 2.5, headroom: 1.15, roundStep: 20 });

      const series: LineSeriesOption[] = [
        {
          id: 'gdp',
          name: t.proj.macroGrowth.gdp,
          type: 'line',
          color: budgetColors.gdp,
          data: zipRecords({
            value: data.growth.gdpYoy.slice(startIdx, endIdx),
            diff: data.growth.gdpDiffUsd.slice(startIdx, endIdx),
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
          data: data.gdpRealGrowthYoy.slice(startIdx, endIdx),
          endLabel: {
            formatter: () => t.proj.macroGrowth.realGdpShort,
          },
        },
        {
          id: 'revenue',
          name: t.proj.macroGrowth.revenue,
          type: 'line',
          color: budgetColors.domesticRev,
          data: zipRecords({
            value: data.growth.revenueYoy.slice(startIdx, endIdx),
            diff: data.growth.revenueDiffUsd.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.revenueShort,
          },
        },
        {
          id: 'expenditure',
          name: t.proj.macroGrowth.expenditure,
          type: 'line',
          color: budgetColors.totalExp,
          data: zipRecords({
            value: data.growth.expenditureYoy.slice(startIdx, endIdx),
            diff: data.growth.expenditureDiffUsd.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.expenditureShort,
          },
        },
        {
          id: 'debt',
          name: t.proj.macroGrowth.debt,
          type: 'line',
          color: budgetColors.govDebt,
          data: zipRecords({
            value: data.growth.debtYoy.slice(startIdx, endIdx),
            diff: data.growth.debtDiffUsd.slice(startIdx, endIdx),
          }),
          endLabel: {
            formatter: () => t.proj.macroGrowth.debtShort,
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
