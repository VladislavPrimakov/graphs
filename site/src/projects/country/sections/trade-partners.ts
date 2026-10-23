import { percentage, round } from '@graphs/shared/math';
import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { CONTROL_DELAYS } from '@/projects/constants';
import { chartOption, createRankedBarSeries, createStaticLegend, createStaticLegendSeries } from '@/utils/chart-builder';
import type { ControlSearchItem } from '@/utils/project';
import { BILLIONS_SCALE, DEFAULT_TOP_COUNT, MAX_PERCENT_AXIS_BOUND, MAX_TOP_COUNT, MIN_PERCENT_AXIS_BOUND, MIN_TOP_COUNT, PERCENT_HEADROOM_RATIO, PERCENT_ROUND_STEP } from '../constants';
import type { Section } from '../project';
import { getDetailedCategoryColor, tradeCategoryColors, tradeColors } from '../tokens';

/** Section builder for Country Foreign Trade Leading Bilateral Trading Partners chart. */
export const tradePartnersSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    sources: [
      {
        name: 'UN Comtrade — International Trade Statistics Database',
        url: 'https://comtradeplus.un.org/',
      },
    ],
    toolbars: ({ countryData }) => {
      const activePartners = countryData.activePartners;
      const activeMacro = countryData.activeMacro;
      const activeDetailed = countryData.activeDetailed;

      const macroItems: ControlSearchItem[] = activeMacro.map(([id, count]) => ({
        value: id,
        label: t.proj.tradeCategories.categories[id],
        count,
        icon: createElement('span', {
          className: 'w-2 h-2 rounded-full shrink-0',
          style: { backgroundColor: tradeCategoryColors[id] },
        }),
      }));

      const detailedItems: ControlSearchItem[] = activeDetailed.map(([code, count]) => {
        const name = (t.proj.tradeCategories.detailed as Record<string, string>)[code] || code;
        return {
          value: code,
          label: `${code} · ${name}`,
          count,
          icon: createElement('span', {
            className: 'w-2 h-2 rounded-full shrink-0',
            style: { backgroundColor: getDetailedCategoryColor(code) },
          }),
        };
      });

      const totalPartners = activePartners.length;
      const minPartners = totalPartners > 0 ? MIN_TOP_COUNT : 0;
      const maxPartners = Math.max(MIN_TOP_COUNT, Math.min(totalPartners, MAX_TOP_COUNT));
      const defaultPartners = Math.max(MIN_TOP_COUNT, Math.min(DEFAULT_TOP_COUNT, totalPartners));

      return [
        {
          id: 'partnersStore',
          urlPrefix: 'partners',
          controls: [
            {
              id: 'mode',
              type: 'toggle',
              defaultValue: 'absolute',
              label: t.common.metric,
              options: [
                { value: 'absolute', label: `${fmt.scale(BILLIONS_SCALE)} ($)` },
                { value: 'percent', label: `${t.common.share} (%)` },
              ],
            },
            {
              id: 'level',
              type: 'toggle',
              defaultValue: 'macro',
              label: t.proj.tradeCategories.level,
              options: [
                { value: 'macro', label: t.proj.tradeCategories.macroLevel },
                { value: 'detailed', label: t.proj.tradeCategories.detailedLevel },
              ],
              onChange: (level) => ({ level, categories: [] }),
            },
            {
              id: 'top',
              type: 'slider',
              min: minPartners,
              max: maxPartners,
              defaultValue: defaultPartners,
              label: t.common.top,
              disabled: (state: Record<string, unknown>) => ((state.countries as string[])?.length ?? 0) > 0,
              debounceMs: CONTROL_DELAYS.slider,
            },
            {
              id: 'countries',
              type: 'multi-search-select',
              placeholder: t.proj.tradePartners.partners,
              emptyLabel: t.proj.tradePartners.noPartnersFound,
              items: activePartners.map(([code, volume]) => ({
                value: code,
                label: fmt.region(code),
                count: volume,
              })),
            },
            {
              id: 'categories',
              type: 'multi-search-select',
              placeholder: (state: Record<string, unknown>) => (state.level === 'detailed' ? t.proj.tradeCategories.detailedCategories : t.proj.tradeCategories.macroCategories),
              emptyLabel: t.proj.tradeCategories.noCategoriesFound,
              items: (state: Record<string, unknown>) => (state.level === 'detailed' ? detailedItems : macroItems),
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ countryData }, { countryStore, partnersStore }) => {
      const years = countryData.years;
      const [selStartYear, selEndYear] = countryStore.years;
      const showLabels = countryStore.labels;
      const isPercent = partnersStore.mode === 'percent';
      const isDetailed = partnersStore.level === 'detailed';
      const top = partnersStore.top;

      const selectedCountries = (partnersStore.countries as string[]) || [];
      const hasSelectedCountries = selectedCountries.length > 0;

      const validCodesSet = new Set(isDetailed ? countryData.activeDetailed.map(([c]) => c) : countryData.activeMacro.map(([id]) => id as string));
      const rawSelectedCategories = (partnersStore.categories as string[]) || [];
      const selectedCategories = rawSelectedCategories.filter((c) => validCodesSet.has(c));
      const hasSelectedCategories = selectedCategories.length > 0;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? years.length : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? 0 : foundEndIdx + 1;

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const countTimeline = visibleTimeline.length;
      const visibleYears = new Array<number>(countTimeline);

      const upperSelectedCountries = selectedCountries.map((c) => c.toUpperCase());
      const visibleTotalExports = new Array<number | null>(countTimeline);
      const visibleTotalImports = new Array<number | null>(countTimeline);
      const visibleTradeBalance = new Array<number>(countTimeline);

      for (let i = 0; i < countTimeline; i++) {
        const y = visibleTimeline[i];
        visibleYears[i] = y.year;

        let baseExp = 0;
        let baseImp = 0;
        if (!hasSelectedCategories) {
          baseExp = y.exports.total;
          baseImp = y.imports.total;
        } else {
          const expCatMap = isDetailed ? y.exports.detailed : y.exports.macro;
          const impCatMap = isDetailed ? y.imports.detailed : y.imports.macro;
          for (let cIdx = 0; cIdx < selectedCategories.length; cIdx++) {
            const catId = selectedCategories[cIdx];
            const expEntry = expCatMap[catId];
            if (expEntry) baseExp += expEntry;
            const impEntry = impCatMap[catId];
            if (impEntry) baseImp += impEntry;
          }
        }

        visibleTotalExports[i] = baseExp > 0 ? round(baseExp, 2) : null;
        visibleTotalImports[i] = baseImp > 0 ? round(baseImp, 2) : null;
        visibleTradeBalance[i] = (visibleTotalExports[i] ?? 0) - (visibleTotalImports[i] ?? 0);
      }

      const activeCodesSet = new Set<string>();
      let maxStack = 0;

      const buildTradeSeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';

        const filteredYearsData: [string, number, number][][] = [];

        for (let i = 0; i < countTimeline; i++) {
          const yRec = visibleTimeline[i];
          const flow = isExp ? yRec.exports : yRec.imports;
          const rawYearMap = flow.partners || {};
          const yearBaseTotal = (isExp ? visibleTotalExports[i] : visibleTotalImports[i]) || 0;
          const yearTop: [string, number, number][] = [];

          if (hasSelectedCountries) {
            for (let k = 0; k < upperSelectedCountries.length; k++) {
              const pCodeUpper = upperSelectedCountries[k];
              const partner = rawYearMap[pCodeUpper];
              if (!partner) continue;

              let val = 0;
              if (hasSelectedCategories) {
                const catMap = isDetailed ? partner.detailed : partner.macro;
                for (let cIdx = 0; cIdx < selectedCategories.length; cIdx++) {
                  const entry = catMap[selectedCategories[cIdx]];
                  if (entry) val += entry;
                }
                val = round(val, 2);
              } else {
                val = partner.total;
              }

              if (val > 0) {
                const share = percentage(val, yearBaseTotal, 1);
                yearTop.push([pCodeUpper, val, share]);
              }
            }
          } else {
            const positiveEntries: [string, number][] = [];

            for (const pCodeUpper in rawYearMap) {
              const partner = rawYearMap[pCodeUpper];
              if (!partner) continue;

              let val = 0;
              if (hasSelectedCategories) {
                const catMap = isDetailed ? partner.detailed : partner.macro;
                for (let cIdx = 0; cIdx < selectedCategories.length; cIdx++) {
                  const entry = catMap[selectedCategories[cIdx]];
                  if (entry) val += entry;
                }
                val = round(val, 2);
              } else {
                val = partner.total;
              }

              if (val > 0) {
                positiveEntries.push([pCodeUpper, val]);
              }
            }

            positiveEntries.sort((a, b) => b[1] - a[1]);
            const topCount = Math.min(top, positiveEntries.length);
            for (let k = 0; k < topCount; k++) {
              const [pCodeUpper, val] = positiveEntries[k];
              const share = percentage(val, yearBaseTotal, 1);
              yearTop.push([pCodeUpper, val, share]);
            }
          }

          filteredYearsData.push(yearTop);
          let yearShareSum = 0;
          for (let k = 0; k < yearTop.length; k++) {
            const [code, , share] = yearTop[k];
            activeCodesSet.add(code);
            yearShareSum += share;
          }
          if (yearShareSum > maxStack) maxStack = yearShareSum;
        }

        return createRankedBarSeries<[string, number, number]>({
          idPrefix: type,
          stack: 'trade',
          categoryCount: countTimeline,
          rankedData: filteredYearsData,
          sign,
          getValue: ([, val, share]) => (isPercent ? share : val),
          getColor: ([code]) => fmt.regionColor(code),
          getName: ([code]) => fmt.region(code),
          getExtraProps: ([code, val, share]) => ({ code, val, share }),
          formatLabel: ({ value, item: [code] }) => {
            const localizedName = fmt.region(code);
            const absVal = Math.abs(value);
            const valStr = `${prefix}${isPercent ? fmt.percent(absVal) : fmt.number(absVal)}`;
            return showLabels ? `${localizedName} ${valStr}` : valStr;
          },
        });
      };

      const expSeries = buildTradeSeries('exp');
      const impSeries = buildTradeSeries('imp');

      const legendCodes = countryData.activePartners.map(([c]) => c as string).filter((c) => activeCodesSet.has(c));
      const legendItems = legendCodes.map((code) => ({
        name: fmt.region(code),
        color: fmt.regionColor(code),
      }));

      const countryName = fmt.region(countryData.code);
      let catTitlePart = '';
      if (hasSelectedCategories) {
        if (selectedCategories.length === 1) {
          const catCode = selectedCategories[0];
          const catName = isDetailed
            ? (t.proj.tradeCategories.detailed as Record<string, string>)[catCode] || catCode
            : (t.proj.tradeCategories.categories as Record<string, string>)[catCode] || catCode;
          catTitlePart = ` · ${catName}`;
        } else {
          catTitlePart = ` (${selectedCategories.length})`;
        }
      }

      const topPart = hasSelectedCountries ? '' : ` (${t.common.top} ${top})`;
      const title = `${countryName} — ${t.proj.tradePartners.title}${catTitlePart}${topPart}`;

      const effectivePercentBound =
        maxStack > 0 ? Math.min(MAX_PERCENT_AXIS_BOUND, Math.ceil((maxStack * PERCENT_HEADROOM_RATIO) / PERCENT_ROUND_STEP) * PERCENT_ROUND_STEP || MIN_PERCENT_AXIS_BOUND) : MAX_PERCENT_AXIS_BOUND;

      return {
        title,
        content: createChart(
          chartOption({
            tooltip: {
              type: 'dual',
              header: ({ name }) => `${t.common.period}: ${name}`,
              positive: {
                title: t.common.exports,
                color: tradeColors.exportTotal,
                total: ({ dataIndex }) => fmt.number(visibleTotalExports[dataIndex] || 0),
              },
              negative: {
                title: t.common.imports,
                color: tradeColors.importTotal,
                total: ({ dataIndex }) => fmt.number(visibleTotalImports[dataIndex] || 0),
              },
              row: ({ data: rowData }) => {
                const { val, share } = rowData as { val: number; share: number };
                return {
                  value: isPercent ? fmt.percent(share) : fmt.number(val),
                  subValue: isPercent ? fmt.number(val) : fmt.percent(share),
                };
              },
              footer: ({ dataIndex }) => {
                const balance = visibleTradeBalance[dataIndex] || 0;
                const sign = balance > 0 ? '+' : '';
                return {
                  label: t.common.balance,
                  value: `${sign}${fmt.number(balance)}`,
                  color: balance < 0 ? 'danger' : 'success',
                };
              },
            },
            legend: createStaticLegend(legendItems),
            xAxis: {
              type: 'category',
              data: visibleYears.map(String),
            },
            yAxis: {
              type: 'value',
              name: isPercent ? '%' : `${fmt.scale(BILLIONS_SCALE)} ($)`,
              max: isPercent ? effectivePercentBound : undefined,
              min: isPercent ? -effectivePercentBound : undefined,
              axisLabel: {
                formatter: (val: number) => String(Math.abs(val)),
              },
            },
            series: [...expSeries, ...impSeries, ...createStaticLegendSeries(legendItems)],
          }),
        ),
      };
    },
  };
};
