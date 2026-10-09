import type { LossesTimelineSectionData } from '@graphs/types/war-rf-ua/losses-timeline';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import { getCategoryIconSvg } from '../components/CategoryIcon';
import type { dict } from '../locales/dict-en';
import { lossColors } from '../tokens';

/** Section builder for Equipment Losses Timeline chart. */
export const lossesTimelineSection: SectionBuilder<LossesTimelineSectionData, typeof dict> = ({ t, fmt }) => {
  const { rf: rfColor, ua: uaColor } = lossColors;
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');

  return chartSection({
    id: 'losses-timeline',
    title: t.proj.timeline.title,
    sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
    buildView: (data) => {
      const { summary, periods, overallTimeline } = data;
      return {
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
        option: chartOption({
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
            rows: ({ data: pointData }) =>
              (pointData?.breakdown || [])
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
        }),
      };
    },
  });
};
