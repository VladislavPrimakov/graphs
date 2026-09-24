import type React from 'react';
import { useState } from 'react';
import type { AttacksSummary, AttacksUnifiedTimeline, CallbackDataParams, EChartsOption } from '@/types';
import { themeColors } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';
import { KpiCard } from '../KpiCard';
import { ViewToggle } from '../ViewToggle';

/** Props for the mirrored missile strikes visualization and KPI section. */
export interface WarAttacksMissilesGraphProps {
  /** Russian Federation strike summary statistics. */
  rf: AttacksSummary;
  /** Ukrainian strike summary statistics. */
  ua: AttacksSummary;
  /** Dual-granularity time-series datasets. */
  timeline: AttacksUnifiedTimeline;
}

/** Mirrored bidirectional bar chart comparing Russian and Ukrainian ballistic and cruise missile strikes with granularity toggle and KPI panels. */
export const WarAttacksMissilesGraph: React.FC<WarAttacksMissilesGraphProps> = ({ rf, ua, timeline }) => {
  const [missileMode, setMissileMode] = useState<'monthly' | 'daily'>('monthly');
  const { rf: rfColors, ua: uaColors } = themeColors.attacks;

  const isMissileDaily = missileMode === 'daily';
  const missileTimeline = isMissileDaily ? timeline.daily : timeline.monthly;

  const missileChartOption: EChartsOption = {
    title: {
      text: isMissileDaily ? 'Daily Missile Strikes & Interceptions' : 'Monthly Missile Strikes: Ballistic vs Cruise',
      subtext: 'Russian launches (top) vs Ukrainian air defence intercepts (bottom)',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const period = items[0]?.name;
        let rfItems = '';
        let uaItems = '';
        items.forEach((item: CallbackDataParams) => {
          const rawVal = Number(item.value);
          const absVal = Math.abs(rawVal);
          if (absVal > 0) {
            const label = String(item.seriesName || '').replace(/^(RF|UA)[:\s]*/i, '');
            const row = createTooltipRow(label, absVal, { dotColor: String(item.color) });
            if (rawVal > 0) rfItems += row;
            else uaItems += row;
          }
        });
        let res = createTooltipHeader(period);
        if (rfItems) {
          res += `<div class="text-[11px] font-semibold text-status-warning uppercase tracking-wider mb-1 mt-1">Russian Strikes:</div><div class="space-y-1 mb-2">${rfItems}</div>`;
        }
        if (uaItems) {
          res += `<div class="text-[11px] font-semibold text-accent-primary uppercase tracking-wider mb-1 mt-1">Ukrainian Strikes:</div><div class="space-y-1">${uaItems}</div>`;
        }
        return res;
      },
    },
    legend: {
      top: 54,
      left: 'center',
      data: ['RF: Ballistic', 'RF: Cruise', 'UA: Ballistic', 'UA: Cruise'],
      textStyle: { color: themeColors.text.secondary },
    },
    grid: {
      top: 100,
      bottom: isMissileDaily ? '16%' : '12%',
      left: '3%',
      right: '3%',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'slider',
        show: isMissileDaily,
        xAxisIndex: [0],
        start: 0,
        end: 100,
        bottom: '2%',
      },
      { type: 'inside', disabled: !isMissileDaily, xAxisIndex: [0] },
    ],
    xAxis: {
      type: 'category',
      data: missileTimeline.labels,
      axisLabel: { rotate: 45, color: themeColors.text.muted, fontSize: 10 },
      axisLine: { onZero: true, lineStyle: { color: themeColors.border.muted } },
    },
    yAxis: {
      type: 'value',
      name: 'Units',
      axisLabel: {
        formatter: (val: number) => Math.abs(val).toLocaleString(),
      },
      splitLine: { lineStyle: { color: themeColors.surface.elevated } },
    },
    series: [
      {
        name: 'RF: Ballistic',
        type: 'bar',
        stack: 'missiles',
        data: missileTimeline.rf_ballistic,
        itemStyle: { color: rfColors.ballistic },
      },
      {
        name: 'RF: Cruise',
        type: 'bar',
        stack: 'missiles',
        data: missileTimeline.rf_cruise,
        itemStyle: { color: rfColors.cruise, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'UA: Ballistic',
        type: 'bar',
        stack: 'missiles',
        data: missileTimeline.ua_ballistic.map((v: number) => -v),
        itemStyle: { color: uaColors.ballistic },
      },
      {
        name: 'UA: Cruise',
        type: 'bar',
        stack: 'missiles',
        data: missileTimeline.ua_cruise.map((v: number) => -v),
        itemStyle: { color: uaColors.cruise, borderRadius: [0, 0, 4, 4] },
      },
    ],
  };

  return (
    <section data-anchor-section="missile-strikes" className="scroll-mt-20 sm:scroll-mt-24 space-y-6">
      {/* Upper KPI cards: RF Missiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Ballistic Total" value={rf.ballistic.total} valueColor={rfColors.ballistic} />
        <KpiCard label={isMissileDaily ? 'Ballistic Daily Avg' : 'Ballistic Monthly Avg'} value={isMissileDaily ? rf.ballistic.daily_avg : rf.ballistic.monthly_avg} valueColor={rfColors.ballistic} />
        <KpiCard
          label={isMissileDaily ? `Ballistic Peak (${rf.ballistic.daily_peak_date})` : `Ballistic Peak (${rf.ballistic.peak_period})`}
          value={isMissileDaily ? rf.ballistic.daily_peak_count : rf.ballistic.peak_count}
          valueColor={rfColors.ballistic}
        />
        <KpiCard label="Cruise Total" value={rf.cruise.total} valueColor={rfColors.cruise} />
        <KpiCard label={isMissileDaily ? 'Cruise Daily Avg' : 'Cruise Monthly Avg'} value={isMissileDaily ? rf.cruise.daily_avg : rf.cruise.monthly_avg} valueColor={rfColors.cruise} />
        <KpiCard
          label={isMissileDaily ? `Cruise Peak (${rf.cruise.daily_peak_date})` : `Cruise Peak (${rf.cruise.peak_period})`}
          value={isMissileDaily ? rf.cruise.daily_peak_count : rf.cruise.peak_count}
          valueColor={rfColors.cruise}
        />
      </div>

      {/* Missile Mirrored Chart */}
      <ChartCard
        anchorId="missile-strikes"
        headerRight={
          <ViewToggle<'monthly' | 'daily'>
            value={missileMode}
            onChange={setMissileMode}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'daily', label: 'Daily' },
            ]}
          />
        }
      >
        <EChart option={missileChartOption} height="480px" />
      </ChartCard>

      {/* Lower KPI cards: UA Missiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Ballistic Intercepts" value={ua.ballistic.total} valueColor={uaColors.ballistic} />
        <KpiCard label={isMissileDaily ? 'Ballistic Daily Avg' : 'Ballistic Monthly Avg'} value={isMissileDaily ? ua.ballistic.daily_avg : ua.ballistic.monthly_avg} valueColor={uaColors.ballistic} />
        <KpiCard
          label={isMissileDaily ? `Ballistic Peak (${ua.ballistic.daily_peak_date})` : `Ballistic Peak (${ua.ballistic.peak_period})`}
          value={isMissileDaily ? ua.ballistic.daily_peak_count : ua.ballistic.peak_count}
          valueColor={uaColors.ballistic}
        />
        <KpiCard label="Cruise Intercepts" value={ua.cruise.total} valueColor={uaColors.cruise} />
        <KpiCard label={isMissileDaily ? 'Cruise Daily Avg' : 'Cruise Monthly Avg'} value={isMissileDaily ? ua.cruise.daily_avg : ua.cruise.monthly_avg} valueColor={uaColors.cruise} />
        <KpiCard
          label={isMissileDaily ? `Cruise Peak (${ua.cruise.daily_peak_date})` : `Cruise Peak (${ua.cruise.peak_period})`}
          value={isMissileDaily ? ua.cruise.daily_peak_count : ua.cruise.peak_count}
          valueColor={uaColors.cruise}
        />
      </div>
    </section>
  );
};

export default WarAttacksMissilesGraph;
