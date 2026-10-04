import type { DefaultLabelFormatterCallbackParams as CallbackDataParams } from 'echarts';
import { themeColors } from '@/styles/tokens';
import { chartSection, type Project } from '@/types';
import { chartOption, createBarSeries, createStackTotalSeries, zipRecords } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

export const project: Project<'ukraine', typeof dict> = {
  ...meta,
  buildSections: ({ data, t, fmt }) => {
    const budgetColors = themeColors.budget;
    const tradeColors = themeColors.trade;
    const totalTradePartners = Math.max(0, ...data.trade.exports.map((e) => e.length), ...data.trade.imports.map((i) => i.length));

    const formatBudgetLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)})` : fmt.number(val));

    const formatGdpLabel = (val: number, pct?: number | null) => (pct != null ? `${fmt.number(val)}\n(${fmt.percent(pct)} ${t.proj.budgetAndDebt.gdp})` : fmt.number(val));

    return [
      chartSection({
        id: 'budget-and-debt',
        anchorId: 'budget-and-debt',
        title: t.proj.budgetAndDebt.title,
        buildView: () => {
          return chartOption({
            title: { text: t.proj.budgetAndDebt.title },
            tooltip: { show: false },
            xAxis: {
              type: 'category',
              data: zipRecords({
                label: data.budgetDebt.yearLabels,
                rate: data.budgetDebt.rates,
                bal: data.budgetDebt.balances,
              }).map(({ label, rate, bal }) => {
                const balSign = `${bal > 0 ? '+' : ''}${fmt.number(bal)}`;
                const balTag = bal < 0 ? 'balNeg' : 'balPos';

                return `{year|${label}}\n{rate|(${t.proj.budgetAndDebt.fxRate}: ${fmt.number(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})}\n{${balTag}|${t.common.balance}: ${balSign}}`;
              }),
              axisLabel: {
                interval: 0,
                rich: {
                  year: {
                    color: themeColors.text.primary,
                  },
                  rate: {
                    color: themeColors.text.muted,
                  },
                  balNeg: {
                    color: themeColors.status.danger,
                  },
                  balPos: {
                    color: themeColors.status.success,
                  },
                },
              },
            },
            yAxis: {
              type: 'value',
              name: `${fmt.scale(1e9)} ($)`,
            },
            series: [
              createBarSeries({
                id: 'defense',
                name: t.proj.budgetAndDebt.defenseSpending,
                stack: 'Expenditures',
                data: zipRecords({
                  value: data.budgetDebt.defense,
                  share: data.budgetDebt.defensePct,
                }),
                color: budgetColors.defense,
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'other_exp',
                name: t.proj.budgetAndDebt.nonDefenseSpending,
                stack: 'Expenditures',
                data: zipRecords({
                  value: data.budgetDebt.otherExp,
                  share: data.budgetDebt.otherExpPct,
                }),
                color: budgetColors.otherExp,
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createStackTotalSeries({
                id: 'exp_total',
                stack: 'Expenditures',
                data: zipRecords({
                  value: data.budgetDebt.totalExp,
                  gdpPct: data.budgetDebt.expGdpPct,
                }),
                formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
              }),
              createBarSeries({
                id: 'domestic_rev',
                name: t.proj.budgetAndDebt.domesticRevenues,
                stack: 'Revenues',
                data: zipRecords({
                  value: data.budgetDebt.domesticRev,
                  share: data.budgetDebt.domesticRevPct,
                }),
                color: budgetColors.domesticRev,
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'grants',
                name: t.proj.budgetAndDebt.grants,
                stack: 'Revenues',
                data: zipRecords({
                  value: data.budgetDebt.grants,
                  share: data.budgetDebt.grantsPct,
                }),
                color: budgetColors.grants,
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createBarSeries({
                id: 'loans',
                name: t.proj.budgetAndDebt.loans,
                stack: 'Revenues',
                data: zipRecords({
                  value: data.budgetDebt.loans,
                  share: data.budgetDebt.loansPct,
                }),
                color: budgetColors.loans,
                formatLabel: ({ value, item }) => formatBudgetLabel(value, item.share),
              }),
              createStackTotalSeries({
                id: 'rev_total',
                stack: 'Revenues',
                data: zipRecords({
                  value: data.budgetDebt.totalRevFin,
                  gdpPct: data.budgetDebt.revGdpPct,
                }),
                formatTotal: ({ total, item }) => formatGdpLabel(total, item.gdpPct),
              }),
              createBarSeries({
                id: 'debt',
                name: t.proj.budgetAndDebt.externalDebt,
                data: zipRecords({
                  value: data.budgetDebt.debt,
                  gdpPct: data.budgetDebt.debtGdpPct,
                }),
                color: budgetColors.debt,
                label: { position: 'top' },
                formatLabel: ({ value, item }) => formatGdpLabel(value, item.gdpPct),
              }),
              createBarSeries({
                id: 'gdp',
                name: t.proj.budgetAndDebt.nominalGdp,
                data: data.budgetDebt.gdp,
                color: budgetColors.gdp,
                label: { position: 'top' },
                formatLabel: ({ value }) => fmt.number(value),
              }),
            ],
          });
        },
      }),
      chartSection({
        id: 'trade-structure',
        anchorId: 'trade-structure',
        title: t.proj.tradeStructure.title,
        buildView: () => {
          return chartOption({
            title: { text: t.proj.tradeStructure.title },
            tooltip: { show: false },
            xAxis: {
              type: 'category',
              data: data.trade.years.map(String),
            },
            yAxis: {
              type: 'value',
              name: `${fmt.scale(1e9)} ($)`,
            },
            series: [
              createBarSeries({
                id: 'exports',
                name: t.proj.tradeStructure.exports,
                color: tradeColors.exportTotal,
                data: data.trade.totalExports,
                label: {
                  position: 'top',
                  color: tradeColors.exportTotal,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
              createBarSeries({
                id: 'imports',
                name: t.proj.tradeStructure.imports,
                color: tradeColors.importTotal,
                data: data.trade.totalImports,
                label: {
                  position: 'top',
                  color: tradeColors.importTotal,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
              {
                id: 'balance',
                name: t.common.balance,
                type: 'line',
                color: tradeColors.balanceLine,
                symbolSize: 12,
                lineStyle: { width: 3, type: 'dashed' },
                data: data.trade.tradeBalance,
                label: {
                  show: true,
                  position: 'bottom',
                  distance: 8,
                  fontSize: 12,
                  formatter: (params: CallbackDataParams) => {
                    const num = Number(params.value);
                    return `${num > 0 ? '+' : ''}${fmt.number(num)}`;
                  },
                },
              },
            ],
          });
        },
      }),
      chartSection({
        id: 'trade-partners',
        anchorId: 'trade-partners',
        title: t.proj.tradePartners.title,
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
            id: 'count',
            type: 'slider',
            min: Math.min(3, totalTradePartners),
            max: Math.min(15, totalTradePartners),
            defaultValue: Math.min(7, totalTradePartners),
            label: t.common.top,
          },
        ],
        buildView: (values) => {
          const count = values.count;
          const isPercent = values.mode === 'percent';

          const buildTradeSeries = (type: 'exp' | 'imp') => {
            const isExp = type === 'exp';
            const dataset = isExp ? data.trade.exports : data.trade.imports;
            const sign = isExp ? 1 : -1;
            const prefix = isExp ? '' : '-';
            const series = [];

            for (let yearIdx = 0; yearIdx < data.trade.years.length; yearIdx++) {
              const yearTop = dataset[yearIdx]?.slice(0, count) || [];
              for (const [code, val, share] of yearTop) {
                const localizedName = fmt.region(code);
                series.push(
                  createBarSeries({
                    id: `${type}-${data.trade.years[yearIdx]}-${code}`,
                    name: localizedName,
                    stack: 'trade',
                    color: fmt.regionColor(code),
                    data: [
                      {
                        value: [yearIdx, sign * (isPercent ? share : val)],
                        val,
                        share,
                        code,
                      },
                    ],
                    formatLabel: ({ value }) => {
                      const absVal = Math.abs(value);
                      return isPercent ? `${localizedName} ${prefix}${fmt.percent(absVal)}` : `${localizedName} ${prefix}${fmt.number(absVal)}`;
                    },
                  }),
                );
              }
            }

            return series;
          };

          return chartOption({
            title: { text: `${t.proj.tradePartners.title} (${t.common.top} ${count})` },
            tooltip: {
              type: 'dual',
              header: ({ name }) => `${t.common.period}: ${name}`,
              positive: {
                title: t.common.exports,
                color: tradeColors.exportTotal,
                total: ({ dataIndex }) => fmt.number(data.trade.totalExports[dataIndex] || 0),
              },
              negative: {
                title: t.common.imports,
                color: tradeColors.importTotal,
                total: ({ dataIndex }) => fmt.number(data.trade.totalImports[dataIndex] || 0),
              },
              row: ({ data }) => {
                const { val, share } = data;
                return {
                  value: isPercent ? fmt.percent(share) : fmt.number(val),
                  subValue: isPercent ? fmt.number(val) : fmt.percent(share),
                };
              },
              footer: ({ dataIndex }) => {
                const balance = data.trade.tradeBalance[dataIndex] || 0;
                const sign = balance > 0 ? '+' : '';
                return {
                  label: t.common.balance,
                  value: `${sign}${fmt.number(balance)}`,
                  color: balance < 0 ? 'danger' : 'success',
                };
              },
            },
            legend: {
              show: false,
            },
            xAxis: {
              type: 'category',
              data: data.trade.years.map(String),
            },
            yAxis: {
              type: 'value',
              name: isPercent ? '%' : `${fmt.scale(1e9)} ($)`,
              axisLabel: {
                formatter: (val: number) => String(Math.abs(val)),
              },
            },
            series: [...buildTradeSeries('exp'), ...buildTradeSeries('imp')],
          });
        },
      }),
    ];
  },
};
