import type { LineSeriesOption } from 'echarts';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, resolveEffectiveMax } from '@/utils/chart-builder';
import { BILLIONS_SCALE, GROWTH_HEADROOM, GROWTH_RATIO, GROWTH_ROUND_STEP, MARK_LINE_WIDTH, REAL_GDP_LINE_WIDTH } from '../constants';
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
    buildView: ({ countryData }, { countryStore }) => {
      const countryName = fmt.region(countryData.code);
      const title = `${countryName} — ${t.proj.macroGrowth.title}`;
      const years = countryData.years;
      const [selStartYear, selEndYear] = countryStore.years;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? years.length : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? 0 : foundEndIdx + 1;

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const count = visibleTimeline.length;

      const visibleYears = new Array<number>(count);
      const gdpYoy = new Array<number | null>(count);
      const gdpRealGrowth = new Array<number | null>(count);
      const revenueYoy = new Array<number | null>(count);
      const expenditureYoy = new Array<number | null>(count);
      const debtYoy = new Array<number | null>(count);

      const gdpSeriesData = new Array<{ value: number | null; diff: number | null }>(count);
      const realGdpSeriesData = new Array<number | null>(count);
      const revenueSeriesData = new Array<{ value: number | null; diff: number | null }>(count);
      const expenditureSeriesData = new Array<{ value: number | null; diff: number | null }>(count);
      const debtSeriesData = new Array<{ value: number | null; diff: number | null }>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        const m = y.macro;
        const gr = m.growth;

        visibleYears[i] = y.year;
        gdpYoy[i] = gr.gdpYoy;
        gdpRealGrowth[i] = m.gdpRealGrowthYoy;
        revenueYoy[i] = gr.revenueYoy;
        expenditureYoy[i] = gr.expenditureYoy;
        debtYoy[i] = gr.debtYoy;

        gdpSeriesData[i] = { value: gr.gdpYoy, diff: gr.gdpDiffUsd };
        realGdpSeriesData[i] = m.gdpRealGrowthYoy;
        revenueSeriesData[i] = { value: gr.revenueYoy, diff: gr.revenueDiffUsd };
        expenditureSeriesData[i] = { value: gr.expenditureYoy, diff: gr.expenditureDiffUsd };
        debtSeriesData[i] = { value: gr.debtYoy, diff: gr.debtDiffUsd };
      }

      const visibleSeries = [gdpYoy, gdpRealGrowth, revenueYoy, expenditureYoy, debtYoy];
      const yMax = resolveEffectiveMax(visibleSeries, {
        ratio: GROWTH_RATIO,
        headroom: GROWTH_HEADROOM,
        roundStep: GROWTH_ROUND_STEP,
      });

      const series: LineSeriesOption[] = [
        {
          id: 'gdp',
          name: t.proj.macroGrowth.gdp,
          type: 'line',
          color: budgetColors.gdp,
          data: gdpSeriesData,
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
              width: MARK_LINE_WIDTH,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          id: 'real_gdp',
          name: t.proj.macroGrowth.realGdp,
          type: 'line',
          color: budgetColors.gdp,
          lineStyle: { type: 'dashed', width: REAL_GDP_LINE_WIDTH },
          data: realGdpSeriesData,
          endLabel: {
            formatter: () => t.proj.macroGrowth.realGdpShort,
          },
        },
        {
          id: 'revenue',
          name: t.proj.macroGrowth.revenue,
          type: 'line',
          color: budgetColors.domesticRev,
          data: revenueSeriesData,
          endLabel: {
            formatter: () => t.proj.macroGrowth.revenueShort,
          },
        },
        {
          id: 'expenditure',
          name: t.proj.macroGrowth.expenditure,
          type: 'line',
          color: budgetColors.totalExp,
          data: expenditureSeriesData,
          endLabel: {
            formatter: () => t.proj.macroGrowth.expenditureShort,
          },
        },
        {
          id: 'debt',
          name: t.proj.macroGrowth.debt,
          type: 'line',
          color: budgetColors.govDebt,
          data: debtSeriesData,
          endLabel: {
            formatter: () => t.proj.macroGrowth.debtShort,
          },
        },
      ];

      return {
        title,
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
                const subValue =
                  item?.diff != null ? `${diffSign}${fmt.number(Math.abs(item.diff), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${fmt.scale(BILLIONS_SCALE)} ($)` : undefined;
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
