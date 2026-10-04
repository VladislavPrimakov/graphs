import { createElement } from 'react';
import { themeColors } from '@/styles/tokens';
import { chartSection, customSection, type Project } from '@/types';
import { chartOption, createBarSeries, zipRecords } from '@/utils/chart-builder';
import { CategoryIcon, getCategoryIconSvg } from './components/CategoryIcon';
import { LazyLossesMap } from './components/LazyLossesMap';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

export const project: Project<'war-rf-ua-losses', typeof dict> = {
  ...meta,
  buildSections: ({ data, t, fmt }) => {
    const { summary, periods, overallTimeline, categoryChart, byCategory } = data;
    const { rf: rfColor, ua: uaColor, rfLight, uaLight } = themeColors.losses;
    const rfName = fmt.region('RU');
    const uaName = fmt.region('UA');

    return [
      chartSection({
        id: 'losses-timeline',
        anchorId: 'losses-timeline',
        title: t.proj.timeline.title,
        kpisTop: [
          { label: `${t.proj.timeline.losses}: ${rfName}`, value: summary.totalRf, valueColor: rfColor },
          { label: `${t.proj.timeline.losses}: ${uaName}`, value: summary.totalUa, valueColor: uaColor },
          {
            label: `${t.common.ratio}: ${rfName} / ${uaName}`,
            value: fmt.ratio(summary.overallRatio, 1, 2),
            valueColor: 'warning',
          },
          {
            label: summary.unclassifiedRecords ? `${t.proj.timeline.totalRecords} (${fmt.number(summary.unclassifiedRecords)} ${t.proj.timeline.unrecognized})` : t.proj.timeline.totalRecords,
            value: summary.totalRecords,
            valueColor: 'default',
          },
        ],
        buildView: () => {
          return chartOption({
            title: { text: t.proj.timeline.title },
            dataZoom: [{ type: 'slider' }, { type: 'inside' }],
            tooltip: {
              type: 'table',
              header: ({ name }) => `${t.common.period}: ${name}`,
              columns: [
                { label: t.common.category, align: 'left' },
                { label: 'RF', align: 'right', color: rfColor },
                { label: 'UA', align: 'right', color: uaColor },
              ],
              rows: ({ data }) =>
                (data?.breakdown || [])
                  .filter((b) => b.rf > 0 || b.ua > 0)
                  .map((b) => ({
                    icon: getCategoryIconSvg(b.category, 12),
                    cells: [t.proj.categories.items[b.category], fmt.number(b.rf), fmt.number(b.ua)],
                    colors: [undefined, b.rf > 0 ? rfColor : 'muted', b.ua > 0 ? uaColor : 'muted'],
                  })),
              footer: ({ dataIndex }) => ({
                cells: [t.proj.timeline.monthTotal, fmt.number(overallTimeline.rf[dataIndex] || 0), fmt.number(overallTimeline.ua[dataIndex] || 0)],
                colors: ['default', rfColor, uaColor],
              }),
            },
            xAxis: {
              type: 'category',
              data: periods,
            },
            yAxis: {
              type: 'value',
              name: t.common.units,
            },
            series: [
              {
                id: 'rf',
                name: rfName,
                type: 'line',
                color: rfColor,
                data: zipRecords({
                  value: overallTimeline.rf,
                  breakdown: overallTimeline.breakdowns,
                }),
              },
              {
                id: 'ua',
                name: uaName,
                type: 'line',
                color: uaColor,
                data: overallTimeline.ua,
              },
            ],
          });
        },
      }),
      chartSection({
        id: 'category-losses',
        anchorId: 'category-losses',
        title: t.proj.categories.title,
        buildView: () => {
          return chartOption({
            title: { text: t.proj.categories.title },
            tooltip: {
              type: 'axis',
              header: ({ data, name }) => ({
                title: data?.category ? t.proj.categories.items[data.category] : name,
                icon: data?.category ? getCategoryIconSvg(data.category, 15) : undefined,
              }),
              row: ({ value }) => ({
                value: fmt.number(value),
              }),
              footer: ({ data }) => {
                if (!data?.ratio) return undefined;
                return {
                  label: `${t.common.ratio}: ${rfName} / ${uaName}`,
                  value: fmt.ratio(data.ratio),
                  color: 'warning',
                };
              },
            },
            xAxis: {
              type: 'category',
              data: categoryChart.categories.map((c) => t.proj.categories.items[c]),
              axisLabel: { rotate: 15 },
            },
            yAxis: {
              type: 'value',
              name: t.common.units,
            },
            series: [
              createBarSeries({
                id: 'rf',
                name: rfName,
                color: rfColor,
                data: zipRecords({
                  value: categoryChart.rf,
                  category: categoryChart.categories,
                  ratio: categoryChart.ratios,
                }),
                label: {
                  position: 'top',
                  color: rfLight,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
              createBarSeries({
                id: 'ua',
                name: uaName,
                color: uaColor,
                data: zipRecords({
                  value: categoryChart.ua,
                  category: categoryChart.categories,
                  ratio: categoryChart.ratios,
                }),
                label: {
                  position: 'top',
                  color: uaLight,
                },
                formatLabel: ({ value }) => fmt.number(value),
              }),
            ],
          });
        },
      }),
      customSection({
        id: 'losses-map',
        anchorId: 'losses-map',
        title: t.proj.map.title,
        render: () => createElement(LazyLossesMap, { data: data.map, t: t.proj }),
      }),
      {
        type: 'breakdown-grid',
        id: 'equipment-breakdown',
        anchorId: 'equipment-breakdown',
        previewLimit: 5,
        categories: summary.categories.map((cat) => {
          const catData = byCategory[cat.id];
          const allRf = catData?.models?.rf || [];
          const allUa = catData?.models?.ua || [];
          const catTitle = t.proj.categories.items[cat.id];
          return {
            id: cat.id,
            title: catTitle,
            icon: createElement(CategoryIcon, { category: cat.id, className: 'h-4 w-auto shrink-0' }),
            badge: cat.ratio ? fmt.ratio(cat.ratio) : undefined,
            lists: [
              {
                label: 'RF',
                total: cat.rf,
                color: themeColors.losses.rf,
                items: allRf.map((m) => ({ name: m.name, value: m.count })),
              },
              {
                label: 'UA',
                total: cat.ua,
                color: themeColors.losses.ua,
                items: allUa.map((m) => ({ name: m.name, value: m.count })),
              },
            ],
          };
        }),
      },
    ];
  },
};
