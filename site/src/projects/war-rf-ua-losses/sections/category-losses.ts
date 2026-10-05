import { themeColors } from '@/styles/tokens';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries, zipRecords } from '@/utils/chart-builder';
import { getCategoryIconSvg } from '../components/CategoryIcon';
import type { dict } from '../locales/dict-en';

/** Section builder for Equipment Losses by Category chart. */
export const categoryLossesSection: SectionBuilder<'war-rf-ua-losses', typeof dict> = ({ data, t, fmt }) => {
  const { categoryChart } = data;
  const { rf: rfColor, ua: uaColor, rfLight, uaLight } = themeColors.losses;
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');

  return chartSection({
    id: 'category-losses',
    title: t.proj.categories.title,
    buildView: () => {
      return chartOption({
        title: { text: t.proj.categories.title },
        tooltip: {
          type: 'axis',
          header: ({ data: pointData, name }) => ({
            title: pointData?.category ? t.proj.categories.items[pointData.category] : name,
            icon: pointData?.category ? getCategoryIconSvg(pointData.category, 15) : undefined,
          }),
          row: ({ value }) => ({
            value: fmt.number(value),
          }),
          footer: ({ data: pointData }) => {
            if (!pointData?.ratio) return undefined;
            return {
              label: `${t.common.ratio}: ${rfName} / ${uaName}`,
              value: fmt.ratio(pointData.ratio),
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
  });
};
