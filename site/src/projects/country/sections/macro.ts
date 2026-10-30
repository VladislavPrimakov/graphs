import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
import { resolveAdaptiveScale } from '@/utils/scale';
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
    buildView: ({ countryData, deflator }, { countryStore }) => {
      const countryName = fmt.region(countryData.code);
      const title = `${countryName} — ${t.proj.macro.title}`;
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

      const { startIdx, endIdx } = resolveVisiblePeriod(countryData.years, countryStore.years, {
        seriesData: [
          countryData.timeline.map((y) => y.macro.gdpNominalUsd),
          countryData.timeline.map((y) => y.macro.govExpenditureUsd),
          countryData.timeline.map((y) => y.macro.govRevenueUsd),
          countryData.timeline.map((y) => y.macro.govDebtUsd),
          countryData.timeline.map((y) => y.macro.govBalanceUsd),
        ],
      });

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const count = visibleTimeline.length;

      const visibleYears = new Array<number>(count);
      const visibleBalancesPct = new Array<number | null>(count);
      const expendituresData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const revenuesData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const debtData = new Array<{ value: number | null; gdpPct: number | null }>(count);
      const gdpData = new Array<number | null>(count);
      const budgetXAxisData = new Array<string>(count);

      const rawBal = new Array<number | null>(count);
      const rawExp = new Array<number | null>(count);
      const rawRev = new Array<number | null>(count);
      const rawDebt = new Array<number | null>(count);
      const rawGdp = new Array<number | null>(count);

      for (let i = 0; i < count; i++) {
        const y = visibleTimeline[i];
        const m = y.macro;
        const yr = y.year;
        const k = useConst ? (macroK ? (macroK[yr] ?? 1.0) : (deflator?.[yr] ?? 1.0)) : 1.0;

        visibleYears[i] = yr;
        visibleBalancesPct[i] = m.govBalancePctGdp;
        rawBal[i] = m.govBalanceUsd != null ? m.govBalanceUsd * k : null;
        rawExp[i] = m.govExpenditureUsd != null ? m.govExpenditureUsd * k : null;
        rawRev[i] = m.govRevenueUsd != null ? m.govRevenueUsd * k : null;
        rawDebt[i] = m.govDebtUsd != null ? m.govDebtUsd * k : null;
        rawGdp[i] = m.gdpNominalUsd != null ? m.gdpNominalUsd * k : null;
      }

      const {
        scaleLabel,
        data: [scaledGdp, scaledDebt, scaledExp, scaledRev, visibleBalances],
      } = resolveAdaptiveScale([rawGdp, rawDebt, rawExp, rawRev, rawBal], fmt);
      const curr = useConst ? '2021 $' : '$';
      const unit = scaleLabel ? `${scaleLabel} (${curr})` : `(${curr})`;

      for (let i = 0; i < count; i++) {
        const yr = visibleYears[i];
        const bal = visibleBalances[i];
        const balPct = visibleBalancesPct[i];
        const m = visibleTimeline[i].macro;
        expendituresData[i] = { value: scaledExp[i], gdpPct: m.govExpenditurePctGdp };
        revenuesData[i] = { value: scaledRev[i], gdpPct: m.govRevenuePctGdp };
        debtData[i] = { value: scaledDebt[i], gdpPct: m.govDebtPctGdp };
        gdpData[i] = scaledGdp[i];

        if (bal == null) {
          budgetXAxisData[i] = `{year|${yr}}`;
        } else {
          const isNeg = bal < 0 || (bal === 0 && (balPct ?? 0) < 0);
          const isPos = bal > 0 || (bal === 0 && (balPct ?? 0) > 0);
          const balSign = `${isPos && bal > 0 ? '+' : ''}${fmt.number(bal)}`;
          const balTag = isNeg ? 'balNeg' : 'balPos';
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
                const isNeg = bal < 0 || (bal === 0 && (balPct ?? 0) < 0);
                const sign = bal > 0 ? '+' : '';
                const pctSign = (balPct ?? 0) > 0 ? '+' : '';
                const pctStr = balPct != null ? ` (${pctSign}${fmt.percent(balPct)} ${t.proj.macro.gdp})` : '';
                return {
                  label: t.proj.macro.balance,
                  value: `${sign}${fmt.number(bal)}${pctStr}`,
                  color: isNeg ? 'danger' : 'success',
                };
              },
            },
            xAxis: {
              type: 'category',
              data: budgetXAxisData,
              axisLabel: {
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
              name: unit,
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
