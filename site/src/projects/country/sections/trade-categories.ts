import { percentage, round } from '@graphs/shared/math';
import type { TradeCategoryId } from '@graphs/shared/types/country';
import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { CONTROL_DELAYS } from '@/projects/constants';
import { chartOption, createRankedBarSeries, createStaticLegend, createStaticLegendSeries } from '@/utils/chart-builder';
import type { ControlSearchItem } from '@/utils/project';
import { BILLIONS_SCALE, DEFAULT_TOP_COUNT, MAX_PERCENT_AXIS_BOUND, MAX_TOP_COUNT, MIN_PERCENT_AXIS_BOUND, MIN_TOP_COUNT, PERCENT_HEADROOM_RATIO, PERCENT_ROUND_STEP } from '../constants';
import type { Section } from '../project';
import { getDetailedCategoryColor, tradeCategoryColors, tradeColors } from '../tokens';

/** Section builder for Country Foreign Trade by Commodity & Service Category chart. */
export const tradeCategoriesSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-categories',
    title: t.proj.tradeCategories.title,
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

      const macroCodesSet = new Set(activeMacro.map(([id]) => id as string));
      const detailedCodesSet = new Set(activeDetailed.map(([code]) => code));

      const totalMacro = activeMacro.length;
      const totalDetailed = activeDetailed.length;
      const minCategories = (state: Record<string, unknown>) => {
        const count = state.level === 'detailed' ? totalDetailed : totalMacro;
        return count > 0 ? MIN_TOP_COUNT : 0;
      };
      const maxCategories = (state: Record<string, unknown>) => {
        const total = state.level === 'detailed' ? totalDetailed : totalMacro;
        return Math.max(MIN_TOP_COUNT, Math.min(total, MAX_TOP_COUNT));
      };
      const defaultCategories = Math.max(MIN_TOP_COUNT, Math.min(DEFAULT_TOP_COUNT, totalMacro));

      return [
        {
          id: 'tradeCategoriesStore',
          urlPrefix: 'tradeCategories',
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
              id: 'count',
              type: 'slider',
              min: minCategories,
              max: maxCategories,
              defaultValue: defaultCategories,
              label: t.common.top,
              disabled: (state: Record<string, unknown>) => {
                const isDet = state.level === 'detailed';
                const cats = (state.categories as string[]) || [];
                const validCodes = isDet ? detailedCodesSet : macroCodesSet;
                return cats.some((c) => validCodes.has(c));
              },
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
    buildView: ({ countryData }, { countryStore, tradeCategoriesStore }) => {
      const countryName = fmt.region(countryData.code);
      const isPercent = tradeCategoriesStore.mode === 'percent';
      const isDetailed = tradeCategoriesStore.level === 'detailed';
      const count = tradeCategoriesStore.count;
      const selectedCountries = (tradeCategoriesStore.countries as string[]) || [];
      const hasSelectedCountries = selectedCountries.length > 0;

      const validCodesSet = new Set(isDetailed ? countryData.activeDetailed.map(([c]) => c) : countryData.activeMacro.map(([id]) => id as string));
      const rawSelectedCategories = (tradeCategoriesStore.categories as string[]) || [];
      const selectedCategories = rawSelectedCategories.filter((c) => validCodesSet.has(c));
      const hasSelectedCategories = selectedCategories.length > 0;

      const baseTitle = hasSelectedCategories ? t.proj.tradeCategories.title : `${t.proj.tradeCategories.title} (${t.common.top} ${count})`;
      const title = `${countryName} — ${baseTitle}`;

      const years = countryData.years;
      const [selStartYear, selEndYear] = countryStore.period;
      const showLabels = countryStore.labels;

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

        if (!hasSelectedCountries) {
          visibleTotalExports[i] = y.exports.total;
          visibleTotalImports[i] = y.imports.total;
        } else {
          let expTot = 0;
          let impTot = 0;
          for (let k = 0; k < upperSelectedCountries.length; k++) {
            const pCode = upperSelectedCountries[k];
            const pExp = y.exports.partners[pCode];
            if (pExp) expTot += pExp.total;
            const pImp = y.imports.partners[pCode];
            if (pImp) impTot += pImp.total;
          }
          visibleTotalExports[i] = expTot > 0 ? round(expTot, 2) : null;
          visibleTotalImports[i] = impTot > 0 ? round(impTot, 2) : null;
        }

        visibleTradeBalance[i] = (visibleTotalExports[i] ?? 0) - (visibleTotalImports[i] ?? 0);
      }

      const getCodeColor = (code: string) => (isDetailed ? getDetailedCategoryColor(code) : tradeCategoryColors[code as TradeCategoryId]);

      const getCodeName = (code: string) =>
        isDetailed ? `${code} · ${(t.proj.tradeCategories.detailed as Record<string, string>)[code] || code}` : (t.proj.tradeCategories.categories as Record<string, string>)[code] || code;

      const activeCodesSet = new Set<string>();
      let maxStack = 0;

      const buildCategorySeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';

        const filteredYearsData: [string, number, number][][] = [];

        for (let i = 0; i < countTimeline; i++) {
          const yRec = visibleTimeline[i];
          const flow = isExp ? yRec.exports : yRec.imports;
          const rawYearMap: Record<string, number> = {};

          if (hasSelectedCountries) {
            for (let k = 0; k < upperSelectedCountries.length; k++) {
              const pCode = upperSelectedCountries[k];
              const p = flow.partners[pCode];
              if (!p) continue;
              const catMap = isDetailed ? p.detailed : p.macro;
              for (const code in catMap) {
                rawYearMap[code] = (rawYearMap[code] || 0) + catMap[code];
              }
            }
          } else {
            const catMap = isDetailed ? flow.detailed : flow.macro;
            for (const code in catMap) {
              rawYearMap[code] = catMap[code];
            }
          }

          const yearTotal = (isExp ? visibleTotalExports[i] : visibleTotalImports[i]) || 0;
          const yearTop: [string, number, number][] = [];

          if (hasSelectedCategories) {
            for (let k = 0; k < selectedCategories.length; k++) {
              const catId = selectedCategories[k];
              const val = rawYearMap[catId];
              if (val != null && val > 0) {
                const roundedVal = round(val, 2);
                const share = percentage(val, yearTotal, 1);
                yearTop.push([catId, roundedVal, share]);
              }
            }
          } else {
            const positiveEntries: [string, number][] = [];
            for (const code in rawYearMap) {
              const val = rawYearMap[code];
              if (val > 0) positiveEntries.push([code, val]);
            }
            positiveEntries.sort((a, b) => b[1] - a[1]);
            const topCount = Math.min(count, positiveEntries.length);
            for (let k = 0; k < topCount; k++) {
              const [code, val] = positiveEntries[k];
              const roundedVal = round(val, 2);
              const share = percentage(val, yearTotal, 1);
              yearTop.push([code, roundedVal, share]);
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
          stack: 'categories',
          categoryCount: countTimeline,
          rankedData: filteredYearsData,
          sign,
          getValue: ([, val, share]) => (isPercent ? share : val),
          getColor: ([code]) => getCodeColor(code),
          getName: ([code]) => getCodeName(code),
          getExtraProps: ([code, val, share]) => ({ code, val, share }),
          formatLabel: ({ item: [code, val, share] }) => {
            const localizedName = getCodeName(code);
            const valStr = `${prefix}${isPercent ? fmt.percent(share) : fmt.number(val)}`;
            return showLabels ? `${localizedName}: ${valStr}` : valStr;
          },
        });
      };

      const expSeries = buildCategorySeries('exp');
      const impSeries = buildCategorySeries('imp');

      const effectivePercentBound =
        maxStack > 0 ? Math.min(MAX_PERCENT_AXIS_BOUND, Math.ceil((maxStack * PERCENT_HEADROOM_RATIO) / PERCENT_ROUND_STEP) * PERCENT_ROUND_STEP || MIN_PERCENT_AXIS_BOUND) : MAX_PERCENT_AXIS_BOUND;

      const legendCodes = (isDetailed ? countryData.activeDetailed : countryData.activeMacro).map(([c]) => c as string).filter((c) => activeCodesSet.has(c));

      const legendItems = legendCodes.map((code) => ({
        name: getCodeName(code),
        color: getCodeColor(code),
      }));

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
                const item = rowData as { val: number; share: number };
                return {
                  value: isPercent ? fmt.percent(item.share) : fmt.number(item.val),
                  subValue: isPercent ? fmt.number(item.val) : fmt.percent(item.share),
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
