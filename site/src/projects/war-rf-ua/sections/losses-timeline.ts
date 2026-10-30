import type { LossesDataset } from '@graphs/shared/types/war-rf-ua/losses';
import { createChart } from '@/components/sections/SectionChart';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import { defineSection, type KpiCardSpec, loadDataset, type ProjectContext } from '@/utils/project';
import { getCategoryIconSvg } from '../components/CategoryIcon';
import type { dict } from '../locales/dict-en';
import { lossColors } from '../tokens';

/** Section builder for Equipment Losses Timeline chart. */
export const lossesTimelineSection = defineSection(({ t, fmt }: ProjectContext<typeof dict>) => {
  const { rf: rfColor, ua: uaColor } = lossColors;
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');

  return {
    id: 'losses-timeline',
    title: t.proj.timeline.title,
    sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
    data: {
      lossesData: () => loadDataset<LossesDataset>('war-rf-ua', 'losses.json'),
    },
    buildView: ({ lossesData }, { lossesStore }) => {
      const { periods, overallTimeline } = lossesData;
      const toolbar = lossesStore;

      const [pFrom, pTo] = toolbar.period;
      const fromMonth = (pFrom.length > 7 ? pFrom.slice(0, 7) : pFrom) || periods[0];
      const toMonth = (pTo.length > 7 ? pTo.slice(0, 7) : pTo) || periods[periods.length - 1];

      const selectedSide = toolbar.side;
      const selectedCategories = (toolbar.categories as string[]) ?? [];
      const hasCatFilter = selectedCategories.length > 0;

      const indices = periods
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p >= fromMonth && p <= toMonth)
        .map(({ idx }) => idx);

      const visiblePeriods = indices.map((i) => periods[i]);

      const visibleRf = indices.map((i) => {
        if (!hasCatFilter) return overallTimeline.rf[i] || 0;
        const bd = overallTimeline.breakdowns[i] || [];
        return bd.filter((b) => selectedCategories.includes(b.category)).reduce((sum, b) => sum + b.rf, 0);
      });

      const visibleUa = indices.map((i) => {
        if (!hasCatFilter) return overallTimeline.ua[i] || 0;
        const bd = overallTimeline.breakdowns[i] || [];
        return bd.filter((b) => selectedCategories.includes(b.category)).reduce((sum, b) => sum + b.ua, 0);
      });

      const visibleBreakdowns = indices.map((i) => {
        const bd = overallTimeline.breakdowns[i] || [];
        return hasCatFilter ? bd.filter((b) => selectedCategories.includes(b.category)) : bd;
      });

      const totalVisibleRf = visibleRf.reduce((a, b) => a + b, 0);
      const totalVisibleUa = visibleUa.reduce((a, b) => a + b, 0);
      const totalVisibleRecords = totalVisibleRf + totalVisibleUa;
      const visibleRatio = totalVisibleRf > 0 && totalVisibleUa > 0 ? fmt.ratio(totalVisibleRf, totalVisibleUa, 2) : undefined;

      const kpis: KpiCardSpec[] = [
        { label: `${t.proj.timeline.losses}: ${rfName}`, value: totalVisibleRf, valueColor: rfColor },
        { label: `${t.proj.timeline.losses}: ${uaName}`, value: totalVisibleUa, valueColor: uaColor },
      ];

      if (visibleRatio) {
        kpis.push({
          label: `${t.common.ratio}: ${rfName} / ${uaName}`,
          value: visibleRatio,
          valueColor: 'warning',
        });
      }

      kpis.push({
        label: t.proj.timeline.totalRecords,
        value: totalVisibleRecords,
        valueColor: 'default',
      });

      const seriesList = [];
      if (selectedSide === 'all' || selectedSide === 'rf') {
        seriesList.push({
          id: 'rf',
          name: rfName,
          type: 'line' as const,
          color: rfColor,
          data: zipRecords({
            value: visibleRf,
            breakdown: visibleBreakdowns,
          }),
        });
      }
      if (selectedSide === 'all' || selectedSide === 'ua') {
        seriesList.push({
          id: 'ua',
          name: uaName,
          type: 'line' as const,
          color: uaColor,
          data: visibleUa,
        });
      }

      return {
        kpisTop: kpis,
        content: createChart(
          chartOption({
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
                cells: [t.proj.timeline.monthTotal, fmt.number(visibleRf[dataIndex] || 0), fmt.number(visibleUa[dataIndex] || 0)],
                colors: ['default', rfColor, uaColor],
              }),
            },
            xAxis: {
              type: 'category',
              data: visiblePeriods,
            },
            yAxis: {
              type: 'value',
              name: t.common.units,
            },
            series: seriesList,
          }),
        ),
      };
    },
  };
});
