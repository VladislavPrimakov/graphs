import { TRADE_CATEGORY_IDS, type TradeCategoryId } from '@graphs/types/ukraine';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
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
        ] as const,
      },
    ] as const,
    buildView: ({ ukraine: dataset }, { ukraine, tradeCategories }) => {
      const data = dataset['trade-categories'];
      const isPercent = tradeCategories.mode === 'percent';
      const [selStartYear, selEndYear] = ukraine?.years ?? [data.years[Math.max(0, data.years.length - 6)], data.years[data.years.length - 1]];
      const showLabels = ukraine?.labels ?? true;
      const tradeYearsStr = data.years.map(String);

      const foundStartIdx = data.years.findIndex((y) => y >= selStartYear);
      const startIdx = foundStartIdx === -1 ? 0 : foundStartIdx;
      const foundEndIdx = data.years.findLastIndex((y) => y <= selEndYear);
      const endIdx = foundEndIdx === -1 ? data.years.length : foundEndIdx + 1;

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
          }),
        ),
      };
    },
  };
};
