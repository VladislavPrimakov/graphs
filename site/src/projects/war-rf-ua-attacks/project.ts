import { themeColors } from '@/styles/tokens';
import { chartSection, type Project } from '@/types';
import { chartOption, createBarSeries } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

export const project: Project<'war-rf-ua-attacks', typeof dict> = {
  ...meta,
  buildSections: ({ data, t, fmt }) => {
    const rf = data.rfAttacks.summary;
    const ua = data.uaAttacks.summary;
    const timeline = data.unifiedTimeline;
    const { rf: rfColors, ua: uaColors } = themeColors.attacks;
    const rfName = fmt.region('RU');
    const uaName = fmt.region('UA');

    return [
      chartSection({
        anchorId: 'uav-dynamics',
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
        buildView: (values) => {
          const isDaily = values.period === 'daily';

          return {
            title: isDaily ? t.proj.uavDynamics.titleDaily : t.proj.uavDynamics.titleMonthly,
            kpisTop: [
              { label: t.proj.uavDynamics.kpis.totalStrikeUavs, value: rf.uavs.total, valueColor: rfColors.uav },
              { label: isDaily ? t.proj.uavDynamics.kpis.dailyAverage : t.proj.uavDynamics.kpis.monthlyAverage, value: isDaily ? rf.uavs.dailyAvg : rf.uavs.monthlyAvg, valueColor: rfColors.uav },
              {
                label: isDaily ? `${t.proj.uavDynamics.kpis.dailyPeak} (${fmt.date(rf.uavs.dailyPeakDate)})` : `${t.proj.uavDynamics.kpis.monthlyPeak} (${rf.uavs.peakPeriod})`,
                value: isDaily ? rf.uavs.dailyPeakCount : rf.uavs.peakCount,
                valueColor: rfColors.uav,
              },
            ],
            kpisBottom: [
              { label: t.proj.uavDynamics.kpis.uavIntercepts, value: ua.uavs.total, valueColor: uaColors.uav },
              { label: isDaily ? t.proj.uavDynamics.kpis.dailyAverage : t.proj.uavDynamics.kpis.monthlyAverage, value: isDaily ? ua.uavs.dailyAvg : ua.uavs.monthlyAvg, valueColor: uaColors.uav },
              {
                label: isDaily ? `${t.proj.uavDynamics.kpis.dailyPeak} (${fmt.date(ua.uavs.dailyPeakDate)})` : `${t.proj.uavDynamics.kpis.monthlyPeak} (${ua.uavs.peakPeriod})`,
                value: isDaily ? ua.uavs.dailyPeakCount : ua.uavs.peakCount,
                valueColor: uaColors.uav,
              },
            ],
            option: chartOption({
              title: {
                text: isDaily ? t.proj.uavDynamics.titleDaily : t.proj.uavDynamics.titleMonthly,
              },
              dataZoom: isDaily ? [{ type: 'slider' }, { type: 'inside' }] : undefined,
              tooltip: {
                type: 'dual',
                header: ({ name }) => `${t.common.period}: ${name}`,
                positive: {
                  title: `${t.proj.uavDynamics.strikes}`,
                  color: rfColors.uav,
                },
                negative: {
                  title: `${t.proj.uavDynamics.strikes}`,
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
      }),
      chartSection({
        anchorId: 'missile-strikes',
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
        buildView: (values) => {
          const isDaily = values.period === 'daily';

          return {
            title: isDaily ? t.proj.missileDynamics.titleDaily : t.proj.missileDynamics.titleMonthly,
            kpisTop: [
              { label: t.proj.missileDynamics.kpis.ballisticTotal, value: rf.ballistic.total, valueColor: rfColors.ballistic },
              {
                label: isDaily ? t.proj.missileDynamics.kpis.ballisticDailyAvg : t.proj.missileDynamics.kpis.ballisticMonthlyAvg,
                value: isDaily ? rf.ballistic.dailyAvg : rf.ballistic.monthlyAvg,
                valueColor: rfColors.ballistic,
              },
              {
                label: isDaily ? `${t.proj.missileDynamics.kpis.ballisticPeak} (${fmt.date(rf.ballistic.dailyPeakDate)})` : `${t.proj.missileDynamics.kpis.ballisticPeak} (${rf.ballistic.peakPeriod})`,
                value: isDaily ? rf.ballistic.dailyPeakCount : rf.ballistic.peakCount,
                valueColor: rfColors.ballistic,
              },
              { label: t.proj.missileDynamics.kpis.cruiseTotal, value: rf.cruise.total, valueColor: rfColors.cruise },
              {
                label: isDaily ? t.proj.missileDynamics.kpis.cruiseDailyAvg : t.proj.missileDynamics.kpis.cruiseMonthlyAvg,
                value: isDaily ? rf.cruise.dailyAvg : rf.cruise.monthlyAvg,
                valueColor: rfColors.cruise,
              },
              {
                label: isDaily ? `${t.proj.missileDynamics.kpis.cruisePeak} (${fmt.date(rf.cruise.dailyPeakDate)})` : `${t.proj.missileDynamics.kpis.cruisePeak} (${rf.cruise.peakPeriod})`,
                value: isDaily ? rf.cruise.dailyPeakCount : rf.cruise.peakCount,
                valueColor: rfColors.cruise,
              },
            ],
            kpisBottom: [
              { label: t.proj.missileDynamics.kpis.ballisticIntercepts, value: ua.ballistic.total, valueColor: uaColors.ballistic },
              {
                label: isDaily ? t.proj.missileDynamics.kpis.ballisticDailyAvg : t.proj.missileDynamics.kpis.ballisticMonthlyAvg,
                value: isDaily ? ua.ballistic.dailyAvg : ua.ballistic.monthlyAvg,
                valueColor: uaColors.ballistic,
              },
              {
                label: isDaily ? `${t.proj.missileDynamics.kpis.ballisticPeak} (${fmt.date(ua.ballistic.dailyPeakDate)})` : `${t.proj.missileDynamics.kpis.ballisticPeak} (${ua.ballistic.peakPeriod})`,
                value: isDaily ? ua.ballistic.dailyPeakCount : ua.ballistic.peakCount,
                valueColor: uaColors.ballistic,
              },
              { label: t.proj.missileDynamics.kpis.cruiseIntercepts, value: ua.cruise.total, valueColor: uaColors.cruise },
              {
                label: isDaily ? t.proj.missileDynamics.kpis.cruiseDailyAvg : t.proj.missileDynamics.kpis.cruiseMonthlyAvg,
                value: isDaily ? ua.cruise.dailyAvg : ua.cruise.monthlyAvg,
                valueColor: uaColors.cruise,
              },
              {
                label: isDaily ? `${t.proj.missileDynamics.kpis.cruisePeak} (${fmt.date(ua.cruise.dailyPeakDate)})` : `${t.proj.missileDynamics.kpis.cruisePeak} (${ua.cruise.peakPeriod})`,
                value: isDaily ? ua.cruise.dailyPeakCount : ua.cruise.peakCount,
                valueColor: uaColors.cruise,
              },
            ],
            option: chartOption({
              title: {
                text: isDaily ? t.proj.missileDynamics.titleDaily : t.proj.missileDynamics.titleMonthly,
              },
              dataZoom: isDaily ? [{ type: 'slider' }, { type: 'inside' }] : undefined,
              tooltip: {
                type: 'dual',
                header: ({ name }) => `${t.common.period}: ${name}`,
                positive: {
                  title: `${t.proj.missileDynamics.strikes}`,
                  color: rfColors.uav,
                  total: true,
                },
                negative: {
                  title: `${t.proj.missileDynamics.strikes}`,
                  color: uaColors.uav,
                  total: true,
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
                  id: 'rf_bal',
                  name: `${rfName}: ${t.proj.missileDynamics.ballistic}`,
                  stack: 'missiles',
                  color: rfColors.ballistic,
                  data: isDaily ? timeline.daily.rfBallistic : timeline.monthly.rfBallistic,
                }),
                createBarSeries({
                  id: 'rf_cru',
                  name: `${rfName}: ${t.proj.missileDynamics.cruise}`,
                  stack: 'missiles',
                  color: rfColors.cruise,
                  data: isDaily ? timeline.daily.rfCruise : timeline.monthly.rfCruise,
                }),
                createBarSeries({
                  id: 'ua_bal',
                  name: `${uaName}: ${t.proj.missileDynamics.ballistic}`,
                  stack: 'missiles',
                  color: uaColors.ballistic,
                  data: (isDaily ? timeline.daily.uaBallistic : timeline.monthly.uaBallistic).map((v) => -Math.abs(v)),
                }),
                createBarSeries({
                  id: 'ua_cru',
                  name: `${uaName}: ${t.proj.missileDynamics.cruise}`,
                  stack: 'missiles',
                  color: uaColors.cruise,
                  data: (isDaily ? timeline.daily.uaCruise : timeline.monthly.uaCruise).map((v) => -Math.abs(v)),
                }),
              ],
            }),
          };
        },
      }),
    ];
  },
};
