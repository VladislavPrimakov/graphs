import { round } from '@graphs/shared/math';
import { createElement } from 'react';
import { createChart } from '@/components/sections/SectionChart';
import { CONTROL_DELAYS } from '@/projects/constants';
import { chartOption, createRankedBarSeries, createStaticLegend, createStaticLegendSeries, resolveVisiblePeriod } from '@/utils/chart-builder';
import type { ControlSearchItem } from '@/utils/project';
import type { Section } from '../project';
import { tradeColors } from '../tokens';

const partnerItemsCache = new WeakMap<object, Map<string, readonly ControlSearchItem[]>>();

/** Section builder for Ukraine Foreign Trade Sovereign Partners chart. */
export const tradePartnersSection: Section = ({ lang, t, fmt }) => {
  return {
    id: 'trade-partners',
    title: t.proj.tradePartners.title,
    sources: [{ name: 'NBU — Merchandise Trade by Partner Nation (xlsx)', url: 'https://bank.gov.ua/files/ES/Trade_y.xlsx' }],
    toolbars: ({ ukraineData }) => {
      const data = ukraineData['trade-partners'];
      let langMap = partnerItemsCache.get(data);
      if (!langMap) {
        langMap = new Map();
        partnerItemsCache.set(data, langMap);
      }

      let partnerItems = langMap.get(lang);
      if (!partnerItems) {
        const volumeByCountry: Record<string, number> = {};
        for (const yearExports of data.exports) {
          for (const [code, val] of yearExports) {
            volumeByCountry[code] = (volumeByCountry[code] || 0) + val;
          }
        }
        for (const yearImports of data.imports) {
          for (const [code, val] of yearImports) {
            volumeByCountry[code] = (volumeByCountry[code] || 0) + val;
          }
        }
        const partnerCodes = Object.keys(volumeByCountry).sort((a, b) => volumeByCountry[b] - volumeByCountry[a]);

        partnerItems = partnerCodes.map((code) => ({
          value: code,
          label: fmt.region(code),
          icon: createElement('span', { className: 'font-mono text-3xs opacity-75' }, code),
        }));
        langMap.set(lang, partnerItems);
      }

      const totalPartners = partnerItems.length;
      const minPartners = totalPartners > 0 ? 1 : 0;
      const maxPartners = Math.max(1, Math.min(totalPartners, 30));
      const defaultPartners = Math.max(1, Math.min(7, totalPartners));

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
                { value: 'absolute', label: `${fmt.scale(1e9)} ($)` },
                { value: 'percent', label: `${t.common.share} (%)` },
              ],
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
              placeholder: t.proj.countries,
              emptyLabel: t.proj.noCountriesFound,
              items: partnerItems,
            },
          ] as const,
        },
      ] as const;
    },
    buildView: ({ ukraineData }, { ukraineStore, partnersStore }) => {
      const data = ukraineData['trade-partners'];
      const showLabels = ukraineStore.labels;
      const isPercent = partnersStore.mode === 'percent';
      const top = partnersStore.top;
      const selectedCountries = partnersStore.countries as string[];
      const hasSelectedCountries = selectedCountries.length > 0;

      const partnerSeriesData: (number | null | undefined)[][] = hasSelectedCountries
        ? selectedCountries.flatMap((c) => [data.exports.map((tuples) => tuples.find(([code]) => code === c)?.[1]), data.imports.map((tuples) => tuples.find(([code]) => code === c)?.[1])])
        : [data.totalExports, data.totalImports];

      const { startIdx, endIdx, visibleYears } = resolveVisiblePeriod(data.years, ukraineStore.years, {
        seriesData: partnerSeriesData,
      });
      const visibleExports = data.exports.slice(startIdx, endIdx);
      const visibleImports = data.imports.slice(startIdx, endIdx);
      const scaledTotalExports = hasSelectedCountries
        ? visibleExports.map((tuples) =>
            round(
              tuples.reduce((sum, [code, val]) => (selectedCountries.includes(code) ? sum + val : sum), 0),
              2,
            ),
          )
        : data.totalExports.slice(startIdx, endIdx);
      const scaledTotalImports = hasSelectedCountries
        ? visibleImports.map((tuples) =>
            round(
              tuples.reduce((sum, [code, val]) => (selectedCountries.includes(code) ? sum + val : sum), 0),
              2,
            ),
          )
        : data.totalImports.slice(startIdx, endIdx);
      const scaledBalance = scaledTotalExports.map((exp, i) => round(exp - (scaledTotalImports[i] || 0), 2));

      const activeCodesSet = new Set<string>();
      let maxStack = 0;

      const buildTradeSeries = (type: 'exp' | 'imp') => {
        const isExp = type === 'exp';
        const dataset = isExp ? visibleExports : visibleImports;
        const sign = isExp ? 1 : -1;
        const prefix = isExp ? '' : '-';

        const filteredYearsData: [string, number, number][][] = [];

        for (let i = 0; i < visibleYears.length; i++) {
          const rawYearList = dataset[i] || [];
          const yearTop = hasSelectedCountries ? rawYearList.filter(([code]) => selectedCountries.includes(code)) : rawYearList.slice(0, top);

          filteredYearsData.push(yearTop);
          let yearShareSum = 0;
          for (const [code, , share] of yearTop) {
            activeCodesSet.add(code);
            yearShareSum += share;
          }
          if (yearShareSum > maxStack) maxStack = yearShareSum;
        }

        return createRankedBarSeries<[string, number, number]>({
          idPrefix: type,
          stack: 'trade',
          categoryCount: visibleYears.length,
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

      const legendItems = Array.from(activeCodesSet).map((code) => ({
        name: fmt.region(code),
        color: fmt.regionColor(code),
      }));

      const effectivePercentBound = maxStack > 0 ? Math.min(100, Math.ceil((maxStack * 1.15) / 5) * 5 || 10) : 100;

      return {
        title: hasSelectedCountries ? t.proj.tradePartners.title : `${t.proj.tradePartners.title} (${t.common.top} ${top})`,
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
                const { val, share } = rowData as { val: number; share: number };
                return {
                  value: isPercent ? fmt.percent(share) : fmt.number(val),
                  subValue: isPercent ? fmt.number(val) : fmt.percent(share),
                };
              },
              footer: ({ dataIndex }) => {
                const balance = scaledBalance[dataIndex] || 0;
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
