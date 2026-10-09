import { TRADE_CATEGORY_IDS, type TradeCategoriesSectionData, type TradeCategoryId } from '@graphs/types/ukraine/trade-categories';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { tradeCategoryColors, tradeColors } from '../tokens';

/** Section builder for Ukraine Foreign Trade Commodity Groups (NBU Categories) chart. */
export const tradeCategoriesSection: SectionBuilder<TradeCategoriesSectionData, typeof dict> = ({ t, fmt }) => {
  return chartSection({
    id: 'trade-categories',
    title: t.proj.tradeCategories.title,
    sources: [{ name: 'NBU — Merchandise Trade by Commodity Group (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    controls: (data) =>
      [
        {
          id: 'labels',
          type: 'checkbox',
          defaultValue: true,
          label: t.common.labels,
        },
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
          id: 'years',
          type: 'range-slider',
          min: data.years[0],
          max: data.years[data.years.length - 1],
          defaultValue: [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]],
          label: t.common.period,
        },
      ] as const,
    buildView: (data, values) => {
      const isPercent = values.mode === 'percent';
      const [startYear, endYear] = values.years;
      const showLabels = values.labels;
      const tradeYearsStr = data.years.map(String);

      const startIdx = Math.max(0, data.years.indexOf(startYear));
      const endIdx = data.years.indexOf(endYear) !== -1 ? data.years.indexOf(endYear) + 1 : data.years.length;

      const visibleYears = data.years.slice(startIdx, endIdx);
      const visibleCategoryExports = data.categoryExports.slice(startIdx, endIdx);
      const visibleCategoryImports = data.categoryImports.slice(startIdx, endIdx);
      const visibleTotalExports = data.totalExports.slice(startIdx, endIdx);
      const visibleTotalImports = data.totalImports.slice(startIdx, endIdx);
      const visibleTradeBalance = visibleTotalExports.map((exp, i) => exp - (visibleTotalImports[i] || 0));
      const categoryColors = tradeCategoryColors;

      const buildCategorySeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const dataset = isExp ? visibleCategoryExports : visibleCategoryImports;
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';
        const series = [];

        for (let i = 0; i < visibleYears.length; i++) {
          const year = visibleYears[i];
          const yearCategories = dataset[i] || [];
          for (const [catId, val, share] of yearCategories) {
            const localizedName = t.proj.tradeCategories[catId as TradeCategoryId];
            series.push(
              createBarSeries({
                id: `${type}-${year}-${catId}`,
                name: localizedName,
                stack: 'categories',
                color: categoryColors[catId as TradeCategoryId],
                label: {
                  show: true,
                  position: 'inside',
                },
                data: [
                  {
                    value: [i, sign * (isPercent ? share : val)],
                    val,
                    share,
                    catId,
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

      return chartOption({
        title: { text: t.proj.tradeCategories.title },
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
          data: TRADE_CATEGORY_IDS.map((id) => ({
            name: t.proj.tradeCategories[id],
            itemStyle: { color: categoryColors[id] },
          })),
        },
        xAxis: {
          type: 'category',
          data: tradeYearsStr.slice(startIdx, endIdx),
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
        series: [...buildCategorySeries('exp'), ...buildCategorySeries('imp')],
      });
    },
  });
};
