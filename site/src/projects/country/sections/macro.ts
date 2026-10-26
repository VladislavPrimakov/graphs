import { round } from '@graphs/shared/math';
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
      const [selStartYear, selEndYear] = countryStore.years;
      const showLabels = countryStore.labels;
      const useConst = Boolean(countryStore.inConstant2021);

      let macroK: Record<number, number> | undefined;
      if (useConst) {
        const baseYear = 2021;
        const timeline = countryData.timeline;
        const baseIndex = timeline.findIndex((item) => item.year === baseYear);
        const baseGdp = baseIndex !== -1 ? timeline[baseIndex].macro.gdpNominalUsd : null;

        if (baseGdp != null && baseGdp > 0) {
          const R: Record<number, number> = { [baseYear]: 1.0 };
          for (let i = baseIndex + 1; i < timeline.length; i++) {
            const yr = timeline[i].year;
            const prevYr = timeline[i - 1].year;
            const growth = timeline[i].macro.gdpRealGrowthYoy;
            R[yr] = growth != null ? (R[prevYr] ?? 1.0) * (1 + growth / 100) : (R[prevYr] ?? 1.0);
          }
          for (let i = baseIndex - 1; i >= 0; i--) {
            const yr = timeline[i].year;
            const nextYr = timeline[i + 1].year;
            const nextGrowth = timeline[i + 1].macro.gdpRealGrowthYoy;
            R[yr] = nextGrowth != null ? (R[nextYr] ?? 1.0) / (1 + nextGrowth / 100) : (R[nextYr] ?? 1.0);
          }

          macroK = {};
          for (let i = 0; i < timeline.length; i++) {
            const item = timeline[i];
            const nom = item.macro.gdpNominalUsd;
            const realGdp = baseGdp * (R[item.year] ?? 1.0);
            macroK[item.year] = nom != null && nom > 0 ? realGdp / nom : 1.0;
          }
        }
      }

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
        const k = useConst && macroK ? (macroK[yr] ?? 1.0) : 1.0;
        const bal = m.govBalanceUsd != null ? round(m.govBalanceUsd * k, 2) : null;

        visibleYears[i] = yr;
        visibleBalances[i] = bal;
        visibleBalancesPct[i] = m.govBalancePctGdp;
        expendituresData[i] = { value: m.govExpenditureUsd != null ? round(m.govExpenditureUsd * k, 2) : null, gdpPct: m.govExpenditurePctGdp };
        revenuesData[i] = { value: m.govRevenueUsd != null ? round(m.govRevenueUsd * k, 2) : null, gdpPct: m.govRevenuePctGdp };
        debtData[i] = { value: m.govDebtUsd != null ? round(m.govDebtUsd * k, 2) : null, gdpPct: m.govDebtPctGdp };
        gdpData[i] = m.gdpNominalUsd != null ? round(m.gdpNominalUsd * k, 2) : null;

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
              name: `${fmt.scale(BILLIONS_SCALE)} (${useConst ? '2021 $' : '$'})`,
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
                name: useConst ? t.proj.macro.gdp : t.proj.macro.nominalGdp,
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
