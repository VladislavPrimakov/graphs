import { TRADE_CATEGORY_IDS, type TradeCategoryId } from '@graphs/shared/types/ukraine';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createRankedBarSeries, createStaticLegend, createStaticLegendSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
import type { Section } from '../project';
import { tradeCategoryColors, tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Commodity Groups (NBU Categories) chart. */
export const tradeCategoriesSection: Section = ({ t, fmt }) => {
  return {
    id: 'trade-categories',
    title: t.proj.tradeCategories.title,
    sources: [{ name: 'NBU — Merchandise Trade by Commodity Group (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    toolbars: [
      {
        id: 'tradeCategoriesStore',
        urlPrefix: 'categories',
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
        ] as const,
      },
    ] as const,
    buildView: ({ ukraineData }, { ukraineStore, tradeCategoriesStore }) => {
      const data = ukraineData['trade-categories'];
      const isPercent = tradeCategoriesStore.mode === 'percent';
      const showLabels = ukraineStore.labels;
      const { startIdx, endIdx, visibleYears } = resolveVisiblePeriod(data.years, ukraineStore.years, {
        seriesData: [data.totalExports, data.totalImports],
      });
      const visibleCategoryExports = data.categoryExports.slice(startIdx, endIdx);
      const visibleCategoryImports = data.categoryImports.slice(startIdx, endIdx);
      const visibleTotalExports = data.totalExports.slice(startIdx, endIdx);
      const visibleTotalImports = data.totalImports.slice(startIdx, endIdx);
      const visibleTradeBalance = visibleTotalExports.map((exp, i) => exp - (visibleTotalImports[i] || 0));
      const categoryColors = tradeCategoryColors;
      let maxStack = 0;

      const buildCategorySeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const dataset = isExp ? visibleCategoryExports : visibleCategoryImports;
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';

        for (let i = 0; i < visibleYears.length; i++) {
          const yearItems = dataset[i] || [];
          let yearShareSum = 0;
          for (const [, , share] of yearItems) {
            yearShareSum += share;
          }
          if (yearShareSum > maxStack) maxStack = yearShareSum;
        }

        return createRankedBarSeries<[string, number, number]>({
          idPrefix: type,
          stack: 'categories',
          categoryCount: visibleYears.length,
          rankedData: dataset,
          sign,
          getValue: ([, val, share]) => (isPercent ? share : val),
          getColor: ([catId]) => categoryColors[catId as TradeCategoryId],
          getName: ([catId]) => t.proj.tradeCategories[catId as TradeCategoryId],
          getExtraProps: ([catId, val, share]) => ({ catId, val, share }),
          formatLabel: ({ item: [catId, val, share] }) => {
            const localizedName = t.proj.tradeCategories[catId as TradeCategoryId];
            const valStr = `${prefix}${isPercent ? fmt.percent(share) : fmt.number(val)}`;
            return showLabels ? `${localizedName}: ${valStr}` : valStr;
          },
        });
      };

      const expSeries = buildCategorySeries('exp');
      const impSeries = buildCategorySeries('imp');

      const legendItems = TRADE_CATEGORY_IDS.map((id) => ({
        name: t.proj.tradeCategories[id],
        color: categoryColors[id],
      }));

      const effectivePercentBound = maxStack > 0 ? Math.min(100, Math.ceil((maxStack * 1.15) / 5) * 5 || 10) : 100;

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
            legend: createStaticLegend(legendItems),
            xAxis: {
              type: 'category',
              data: visibleYears.map(String),
            },
            yAxis: {
              type: 'value',
              name: isPercent ? '%' : `${fmt.scale(1e9)} ($)`,
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
