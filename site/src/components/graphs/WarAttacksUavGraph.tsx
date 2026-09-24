import type React from 'react';
import { useState } from 'react';
import type { AttacksSummary, AttacksUnifiedTimeline, CallbackDataParams, EChartsOption } from '@/types';
import { themeColors } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';
import { KpiCard } from '../KpiCard';
import { ViewToggle } from '../ViewToggle';

/** Props for the mirrored UAV strike dynamics visualization and KPI section. */
export interface WarAttacksUavGraphProps {
  /** Russian Federation strike summary statistics. */
  rf: AttacksSummary;
  /** Ukrainian strike summary statistics. */
  ua: AttacksSummary;
  /** Dual-granularity time-series datasets. */
  timeline: AttacksUnifiedTimeline;
}

/** Mirrored bidirectional bar chart comparing Russian and Ukrainian long-range strike UAV launches with monthly/daily views and KPI panels. */
export const WarAttacksUavGraph: React.FC<WarAttacksUavGraphProps> = ({ rf, ua, timeline }) => {
  const [uavMode, setUavMode] = useState<'monthly' | 'daily'>('monthly');
  const { rf: rfColors, ua: uaColors } = themeColors.attacks;

  const isUavDaily = uavMode === 'daily';
  const uavTimeline = isUavDaily ? timeline.daily : timeline.monthly;

  const uavChartOption: EChartsOption = {
    title: {
      text: isUavDaily ? 'Daily Strike UAV Launches & Interceptions' : 'Monthly Strike UAV Launches & Interceptions',
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
            const row = createTooltipRow('Strike UAVs', absVal, { dotColor: String(item.color) });
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
      data: ['RF Strike UAVs', 'UA Strike UAVs'],
      textStyle: { color: themeColors.text.secondary },
    },
    grid: {
      top: 100,
      bottom: isUavDaily ? '16%' : '12%',
      left: '3%',
      right: '3%',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'slider',
        show: isUavDaily,
        xAxisIndex: [0],
        start: 0,
        end: 100,
        bottom: '2%',
      },
      { type: 'inside', disabled: !isUavDaily, xAxisIndex: [0] },
    ],
    xAxis: {
      type: 'category',
      data: uavTimeline.labels,
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
        name: 'RF Strike UAVs',
        type: 'bar',
        stack: 'uav',
        data: uavTimeline.rf_uavs,
        itemStyle: { color: rfColors.uav, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'UA Strike UAVs',
        type: 'bar',
        stack: 'uav',
        data: uavTimeline.ua_uavs.map((v: number) => -v),
        itemStyle: { color: uaColors.uav, borderRadius: [0, 0, 4, 4] },
      },
    ],
  };

  return (
    <section data-anchor-section="uav-dynamics" className="scroll-mt-20 sm:scroll-mt-24 space-y-6">
      {/* Upper KPI cards: RF UAVs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Strike UAVs" value={rf.uavs.total} valueColor={rfColors.uav} />
        <KpiCard label={isUavDaily ? 'Daily Average' : 'Monthly Average'} value={isUavDaily ? rf.uavs.daily_avg : rf.uavs.monthly_avg} valueColor={rfColors.uav} />
        <KpiCard
          label={isUavDaily ? `Peak Daily Volume (${rf.uavs.daily_peak_date})` : `Peak Monthly Volume (${rf.uavs.peak_period})`}
          value={isUavDaily ? rf.uavs.daily_peak_count : rf.uavs.peak_count}
          valueColor={rfColors.uav}
        />
      </div>

      {/* UAV Mirrored Chart */}
      <ChartCard
        anchorId="uav-dynamics"
        headerRight={
          <ViewToggle<'monthly' | 'daily'>
            value={uavMode}
            onChange={setUavMode}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'daily', label: 'Daily' },
            ]}
          />
        }
      >
        <EChart option={uavChartOption} height="480px" />
      </ChartCard>

      {/* Lower KPI cards: UA UAVs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Intercepted UAVs" value={ua.uavs.total} valueColor={uaColors.uav} />
        <KpiCard label={isUavDaily ? 'Daily Average' : 'Monthly Average'} value={isUavDaily ? ua.uavs.daily_avg : ua.uavs.monthly_avg} valueColor={uaColors.uav} />
        <KpiCard
          label={isUavDaily ? `Peak Daily Volume (${ua.uavs.daily_peak_date})` : `Peak Monthly Volume (${ua.uavs.peak_period})`}
          value={isUavDaily ? ua.uavs.daily_peak_count : ua.uavs.peak_count}
          valueColor={uaColors.uav}
        />
      </div>
    </section>
  );
};

export default WarAttacksUavGraph;
