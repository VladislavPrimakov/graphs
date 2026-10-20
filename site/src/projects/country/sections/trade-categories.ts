import type { TradeCategoryId } from '@graphs/types/country';
import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
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
    toolbars: ({ country, meta }) => {
      const activeMacro = country?.categories?.activeMacro ?? [];
      const activeDetailed = country?.categories?.activeDetailed ?? [];

      return [
        {
          id: 'tradeCategories',
          controls: [
            {
              id: 'mode',
              type: 'toggle',
              defaultValue: 'absolute',
              label: t.common.metric,
              options: [
                { value: 'absolute', label: `${fmt.scale(1e9)} ($)` },
                { value: 'percent', label: `${t.common.share} (%)` },
              ],
            },
            {
              id: 'categories',
              type: 'multi-search-select',
              placeholder: t.proj.tradeCategories.macroCategories,
              emptyLabel: t.proj.tradeCategories.noCategoriesFound,
              items: activeMacro.map(([id, count]) => ({
                value: id,
                label: t.proj.tradeCategories.categories[id],
                count,
                icon: createElement('span', {
                  className: 'w-2 h-2 rounded-full shrink-0',
                  style: { backgroundColor: tradeCategoryColors[id] },
                }),
              })),
            },
            {
              id: 'subcategories',
              type: 'multi-search-select',
              placeholder: t.proj.tradeCategories.detailedCategories,
              emptyLabel: t.proj.tradeCategories.noCategoriesFound,
              items: (state: Record<string, unknown>) => {
                const selectedMacros = (state.categories as TradeCategoryId[]) || [];
                let codes = activeDetailed;
                if (selectedMacros.length > 0 && meta?.categories) {
                  const allowedCodes = new Set(selectedMacros.flatMap((id) => meta.categories[id] || []));
                  codes = codes.filter(([c]) => allowedCodes.has(c));
                }
                return codes.map(([code, count]) => {
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
              },
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ country }, stores) => {
      const countryStore = stores.country;
      const tradeCategories = stores.tradeCategories;
      const isPercent = tradeCategories?.mode === 'percent';
      const selectedMacros = (tradeCategories?.categories as string[]) || [];
      const selectedSubs = (tradeCategories?.subcategories as string[]) || [];
      const isDetailedMode = selectedSubs.length > 0;

      const years = country.years;
      const [selStartYear, selEndYear] = countryStore?.period ?? [years[Math.max(0, years.length - 6)], years[years.length - 1]];
      const showLabels = countryStore?.labels ?? true;

      const foundStartIdx = years.findIndex((y: number) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = years.findLastIndex((y: number) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? years.length : foundEndIdx + 1;

      const visibleYears = years.slice(startIdx, endIdx);
      const visibleTotalExports = country.trade.totalExportsUsd.slice(startIdx, endIdx);
      const visibleTotalImports = country.trade.totalImportsUsd.slice(startIdx, endIdx);
      const visibleTradeBalance = visibleTotalExports.map((exp, i) => (exp ?? 0) - (visibleTotalImports[i] ?? 0));

      const visibleExports = (isDetailedMode ? country.categories.detailed.exports : country.categories.macro.exports).slice(startIdx, endIdx);
      const visibleImports = (isDetailedMode ? country.categories.detailed.imports : country.categories.macro.imports).slice(startIdx, endIdx);

      const getCodeColor = (code: string) => (isDetailedMode ? getDetailedCategoryColor(code) : tradeCategoryColors[code as TradeCategoryId]);

      const getCodeName = (code: string) =>
        isDetailedMode ? `${code} · ${(t.proj.tradeCategories.detailed as Record<string, string>)[code] || code}` : (t.proj.tradeCategories.categories as Record<string, string>)[code] || code;

      const activeCodesSet = new Set<string>();

      const buildCategorySeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const dataset = isExp ? visibleExports : visibleImports;
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';
        const series = [];

        for (let i = 0; i < visibleYears.length; i++) {
          const rawYearList = dataset[i] || [];
          const yearTop = isDetailedMode
            ? rawYearList.filter(([code]) => selectedSubs.includes(code))
            : selectedMacros.length > 0
              ? rawYearList.filter(([code]) => selectedMacros.includes(code))
              : rawYearList;

          for (const [code, val, share] of yearTop) {
            activeCodesSet.add(code);
            const localizedName = getCodeName(code);

            series.push(
              createBarSeries({
                id: `${type}-${visibleYears[i]}-${code}`,
                name: localizedName,
                stack: 'categories',
                color: getCodeColor(code),
                label: {
                  show: true,
                  position: 'inside',
                },
                data: [
                  {
                    value: [i, sign * (isPercent ? share : val)],
                    val,
                    share,
                    code,
                  },
                ],
                formatLabel: ({ item }) => {
                  const valStr = `${prefix}${isPercent ? fmt.percent(item.share) : fmt.number(item.val)}`;
                  return showLabels ? `${localizedName}: ${valStr}` : valStr;
                },
              }),
            );
          }
        }

        return series;
      };

      const expSeries = buildCategorySeries('exp');
      const impSeries = buildCategorySeries('imp');

      const legendCodes = isDetailedMode
        ? (country.categories.activeDetailed ?? []).map(([c]) => c).filter((c) => activeCodesSet.has(c))
        : (country.categories.activeMacro ?? []).map(([c]) => c).filter((c) => activeCodesSet.has(c));

      return {
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
            legend: {
              show: true,
              data: legendCodes.map((code) => ({
                name: getCodeName(code),
                itemStyle: { color: getCodeColor(code) },
              })),
            },
            xAxis: {
              type: 'category',
              data: visibleYears.map(String),
            },
            yAxis: {
              type: 'value',
              name: isPercent ? '%' : `${fmt.scale(1e9)} ($)`,
              max: isPercent ? 100 : undefined,
              min: isPercent ? -100 : undefined,
              axisLabel: {
                formatter: (val: number) => String(Math.abs(val)),
              },
            },
            series: [...expSeries, ...impSeries],
          }),
        ),
      };
    },
  };
};
