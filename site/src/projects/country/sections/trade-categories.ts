import { percentage, round } from '@graphs/shared/math';
import type { TradeCategoryId } from '@graphs/shared/types/country';
import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { CONTROL_DELAYS } from '@/projects/constants';
import { chartOption, createRankedBarSeries, createStaticLegend, createStaticLegendSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
import type { ControlSearchItem } from '@/utils/project';
import { resolveAdaptiveScale } from '@/utils/scale';
import { DEFAULT_TOP_COUNT, MAX_PERCENT_AXIS_BOUND, MAX_TOP_COUNT, MIN_PERCENT_AXIS_BOUND, MIN_TOP_COUNT, PERCENT_HEADROOM_RATIO, PERCENT_ROUND_STEP } from '../constants';
import type { Section } from '../project';
import { getDetailedCategoryColor, tradeCategoryColors, tradeColors } from '../tokens';
import { getFlowVolume, getYearCategoryBreakdown, resolveFlowScale } from '../trade';

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
          urlPrefix: 'categories',
          controls: [
            {
              id: 'mode',
              type: 'toggle',
              defaultValue: 'absolute',
              label: t.common.metric,
              options: (state: Record<string, unknown>) => {
                const isDet = state.level === 'detailed';
                const selCountries = (state.countries as string[]) || [];
                const rawCats = (state.categories as string[]) || [];
                const selCats = rawCats.filter((c) => (isDet ? detailedCodesSet.has(c) : macroCodesSet.has(c)));
                const scaleLabel = resolveFlowScale(countryData.timeline, isDet, selCountries, selCats, fmt);
                return [
                  { value: 'absolute', label: scaleLabel ? `${scaleLabel} ($)` : '$' },
                  { value: 'percent', label: `${t.common.share} (%)` },
                ];
              },
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
              formatCount: fmt.currency,
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
              formatCount: fmt.currency,
              items: (state: Record<string, unknown>) => (state.level === 'detailed' ? detailedItems : macroItems),
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ countryData, deflator }, { countryStore, tradeCategoriesStore }) => {
      const countryName = fmt.region(countryData.code);
      const isPercent = tradeCategoriesStore.mode === 'percent';
      const isDetailed = tradeCategoriesStore.level === 'detailed';
      const top = tradeCategoriesStore.top;
      const selectedCountries = (tradeCategoriesStore.countries as string[]) || [];
      const useConst = Boolean(countryStore.inConstant2021);

      const rawSelectedCategories = (tradeCategoriesStore.categories as string[]) || [];
      const selectedCategories =
        rawSelectedCategories.length > 0
          ? rawSelectedCategories.filter((c) => (isDetailed ? countryData.activeDetailed.some(([code]) => code === c) : countryData.activeMacro.some(([id]) => id === c)))
          : [];
      const hasSelectedCategories = selectedCategories.length > 0;

      const baseTitle = hasSelectedCategories ? t.proj.tradeCategories.title : `${t.proj.tradeCategories.title} (${t.common.top} ${top})`;
      const title = `${countryName} — ${baseTitle}`;

      const { startIdx, endIdx } = resolveVisiblePeriod(countryData.years, countryStore.years, {
        seriesData: [
          countryData.timeline.map((y) => getFlowVolume(y.exports, isDetailed, selectedCountries, selectedCategories) || null),
          countryData.timeline.map((y) => getFlowVolume(y.imports, isDetailed, selectedCountries, selectedCategories) || null),
        ],
      });
      const showLabels = countryStore.labels;

      const visibleTimeline = startIdx < endIdx ? countryData.timeline.slice(startIdx, endIdx) : [];
      const countTimeline = visibleTimeline.length;
      const visibleYears = new Array<number>(countTimeline);

      const visibleBaseExports = new Array<number>(countTimeline);
      const visibleBaseImports = new Array<number>(countTimeline);
      const visibleTotalExports = new Array<number | null>(countTimeline);
      const visibleTotalImports = new Array<number | null>(countTimeline);
      const visibleTradeBalance = new Array<number>(countTimeline);

      for (let i = 0; i < countTimeline; i++) {
        const y = visibleTimeline[i];
        const kFactor = useConst ? (deflator?.[y.year] ?? 1) : 1;
        visibleYears[i] = y.year;

        const baseExp = getFlowVolume(y.exports, isDetailed, selectedCountries, []);
        const baseImp = getFlowVolume(y.imports, isDetailed, selectedCountries, []);
        const expTot = hasSelectedCategories ? getFlowVolume(y.exports, isDetailed, selectedCountries, selectedCategories) : baseExp;
        const impTot = hasSelectedCategories ? getFlowVolume(y.imports, isDetailed, selectedCountries, selectedCategories) : baseImp;

        visibleBaseExports[i] = baseExp > 0 ? round(baseExp * kFactor, 2) : 0;
        visibleBaseImports[i] = baseImp > 0 ? round(baseImp * kFactor, 2) : 0;
        visibleTotalExports[i] = expTot > 0 ? round(expTot * kFactor, 2) : null;
        visibleTotalImports[i] = impTot > 0 ? round(impTot * kFactor, 2) : null;
        visibleTradeBalance[i] = (visibleTotalExports[i] ?? 0) - (visibleTotalImports[i] ?? 0);
      }

      const {
        divisor,
        scaleLabel,
        data: [scaledTotalExports, scaledTotalImports, scaledTradeBalance],
      } = resolveAdaptiveScale([visibleTotalExports, visibleTotalImports, visibleTradeBalance], fmt);
      const curr = useConst ? '2021 $' : '$';
      const unit = scaleLabel ? `${scaleLabel} (${curr})` : `(${curr})`;

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
          const kFactor = useConst ? (deflator?.[yRec.year] ?? 1) : 1;
          const flow = isExp ? yRec.exports : yRec.imports;
          const rawYearMap = getYearCategoryBreakdown(flow, isDetailed, selectedCountries);

          const yearBaseTotal = (isExp ? visibleBaseExports[i] : visibleBaseImports[i]) || 0;
          const yearTop: [string, number, number][] = [];

          let yearShareSum = 0;

          if (hasSelectedCategories) {
            for (let k = 0; k < selectedCategories.length; k++) {
              const catId = selectedCategories[k];
              const val = rawYearMap[catId];
              if (val != null && val > 0) {
                const deflatedVal = val * kFactor;
                const roundedVal = round(deflatedVal / divisor, 2);
                const share = percentage(deflatedVal, yearBaseTotal, 1);
                yearTop.push([catId, roundedVal, share]);
                activeCodesSet.add(catId);
                yearShareSum += share;
              }
            }
          } else {
            const positiveEntries: [string, number][] = [];
            for (const code in rawYearMap) {
              const val = rawYearMap[code];
              if (val > 0) positiveEntries.push([code, val]);
            }
            positiveEntries.sort((a, b) => b[1] - a[1]);
            const topCount = Math.min(top, positiveEntries.length);
            for (let k = 0; k < topCount; k++) {
              const [code, val] = positiveEntries[k];
              const deflatedVal = val * kFactor;
              const roundedVal = round(deflatedVal / divisor, 2);
              const share = percentage(deflatedVal, yearBaseTotal, 1);
              yearTop.push([code, roundedVal, share]);
              activeCodesSet.add(code);
              yearShareSum += share;
            }
          }

          filteredYearsData.push(yearTop);
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

      const activeList = isDetailed ? countryData.activeDetailed : countryData.activeMacro;
      const legendItems = activeList
        .filter(([code]) => activeCodesSet.has(code))
        .map(([code]) => ({
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
                total: ({ dataIndex }) => fmt.number(scaledTotalExports[dataIndex] || 0),
              },
              negative: {
                title: t.common.imports,
                color: tradeColors.importTotal,
                total: ({ dataIndex }) => fmt.number(scaledTotalImports[dataIndex] || 0),
              },
              row: ({ data: rowData }) => {
                const item = rowData as { val: number; share: number };
                return {
                  value: isPercent ? fmt.percent(item.share) : fmt.number(item.val),
                  subValue: isPercent ? fmt.number(item.val) : fmt.percent(item.share),
                };
              },
              footer: ({ dataIndex }) => {
                const balance = scaledTradeBalance[dataIndex] || 0;
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
              name: isPercent ? '%' : unit,
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
