import type { UavStrikesSectionData } from '@graphs/types/war-rf-ua/uav-strikes';
import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';
import { attackColors } from '../tokens';

/** Section builder for UAV Strikes & Interceptions Dynamics chart. */
export const uavStrikesSection: SectionBuilder<UavStrikesSectionData, typeof dict> = ({ t, fmt }) => {
  const { rf: rfColors, ua: uaColors } = attackColors;
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');

  return chartSection({
    id: 'uav-strikes',
    title: t.proj.uavStrikes.titleMonthly,
    sources: [
      { name: 'Kaggle: Massive Missile Attacks on Ukraine (piterfm)', url: 'https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine' },
      { name: 'Ministry of Defence of the Russian Federation (@mod_russia)', url: 'https://t.me/mod_russia' },
    ],
    controls: [
      {
        id: 'period',
        type: 'toggle',
        defaultValue: 'monthly',
        label: t.common.period,
        options: [
          { value: 'monthly', label: t.common.monthly },
          { value: 'daily', label: t.common.daily },
        ],
      },
    ],
    buildView: (data, values) => {
      const rf = data.rfAttacks.summary;
      const ua = data.uaAttacks.summary;
      const timeline = data.unifiedTimeline;
      const isDaily = values.period === 'daily';

      return {
        title: isDaily ? t.proj.uavStrikes.titleDaily : t.proj.uavStrikes.titleMonthly,
        kpisTop: [
          { label: t.proj.uavStrikes.kpis.totalStrikeUavs, value: rf.uavs.total, valueColor: rfColors.uav },
          { label: isDaily ? t.proj.uavStrikes.kpis.dailyAverage : t.proj.uavStrikes.kpis.monthlyAverage, value: isDaily ? rf.uavs.dailyAvg : rf.uavs.monthlyAvg, valueColor: rfColors.uav },
          {
            label: isDaily ? `${t.proj.uavStrikes.kpis.dailyPeak} (${fmt.date(rf.uavs.dailyPeakDate)})` : `${t.proj.uavStrikes.kpis.monthlyPeak} (${rf.uavs.peakPeriod})`,
            value: isDaily ? rf.uavs.dailyPeakCount : rf.uavs.peakCount,
            valueColor: rfColors.uav,
          },
        ],
        kpisBottom: [
          { label: t.proj.uavStrikes.kpis.uavIntercepts, value: ua.uavs.total, valueColor: uaColors.uav },
          { label: isDaily ? t.proj.uavStrikes.kpis.dailyAverage : t.proj.uavStrikes.kpis.monthlyAverage, value: isDaily ? ua.uavs.dailyAvg : ua.uavs.monthlyAvg, valueColor: uaColors.uav },
          {
            label: isDaily ? `${t.proj.uavStrikes.kpis.dailyPeak} (${fmt.date(ua.uavs.dailyPeakDate)})` : `${t.proj.uavStrikes.kpis.monthlyPeak} (${ua.uavs.peakPeriod})`,
            value: isDaily ? ua.uavs.dailyPeakCount : ua.uavs.peakCount,
            valueColor: uaColors.uav,
          },
        ],
        option: chartOption({
          title: {
            text: isDaily ? t.proj.uavStrikes.titleDaily : t.proj.uavStrikes.titleMonthly,
          },
          dataZoom: isDaily ? [{ type: 'slider' }, { type: 'inside' }] : undefined,
          tooltip: {
            type: 'dual',
            header: ({ name }) => `${t.common.period}: ${name}`,
            positive: {
              title: `${t.proj.uavStrikes.strikes}`,
              color: rfColors.uav,
            },
            negative: {
              title: `${t.proj.uavStrikes.strikes}`,
              color: uaColors.uav,
            },
            formatValue: fmt.number,
            footer: {
              type: 'ratio',
              label: `${t.common.ratio}: ${rfName} / ${uaName}`,
              format: fmt.ratio,
            },
          },
          xAxis: {
            type: 'category',
            data: isDaily ? timeline.daily.labels : timeline.monthly.labels,
          },
          yAxis: {
            type: 'value',
            name: t.common.units,
            axisLabel: {
              formatter: (val: number) => fmt.number(Math.abs(val)),
            },
          },
          series: [
            createBarSeries({
              id: 'rf_uav',
              name: `${rfName}`,
              stack: 'uav',
              color: rfColors.uav,
              data: isDaily ? timeline.daily.rfUavs : timeline.monthly.rfUavs,
            }),
            createBarSeries({
              id: 'ua_uav',
              name: `${uaName}`,
              stack: 'uav',
              color: uaColors.uav,
              data: (isDaily ? timeline.daily.uaUavs : timeline.monthly.uaUavs).map((v) => -Math.abs(v)),
            }),
          ],
        }),
      };
    },
  });
};
