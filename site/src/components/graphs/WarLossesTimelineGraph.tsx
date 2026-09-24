import type React from 'react';
import type { CallbackDataParams, EChartsOption, LossOverallTimelineData, LossTimelineBreakdownItem, LossTimelineDataPoint } from '@/types';
import { themeColors } from '../../styles/tokens';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

export type { LossTimelineBreakdownItem, LossTimelineDataPoint };

/** Props for the equipment losses monthly timeline line chart. */
export interface WarLossesTimelineGraphProps {
  /** Sequential month labels in `YYYY-MM` format. */
  periods: string[];
  /** Overall monthly losses timeline series. */
  overall_timeline: LossOverallTimelineData;
}

/** Interactive timeline line chart visualizing monthly verified equipment losses across all categories from February 2022 to the current period. */
export const WarLossesTimelineGraph: React.FC<WarLossesTimelineGraphProps> = ({ periods, overall_timeline }) => {
  const { rf: rfColor, ua: uaColor } = themeColors.losses;

  const timelineChartOption: EChartsOption = {
    title: {
      text: 'Monthly Timeline of Confirmed Equipment Losses',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const p0 = items[0];
        const dataObj = p0?.data as LossTimelineDataPoint | undefined;
        const breakdown = dataObj?.breakdown || [];
        const period = p0?.name || '';
        const rfTotal = dataObj?.rf !== undefined ? dataObj.rf : items[0] ? items[0].value : 0;
        const uaTotal = dataObj?.ua !== undefined ? dataObj.ua : items[1] ? items[1].value : 0;

        let rowsHtml = '';
        let hasRows = false;
        for (let i = 0; i < breakdown.length; i++) {
          const b = breakdown[i];
          if (b.rf === 0 && b.ua === 0) continue;
          hasRows = true;
          const rfClass = b.rf > 0 ? 'text-status-danger font-medium' : 'text-content-dim';
          const uaClass = b.ua > 0 ? 'text-accent-blue font-medium' : 'text-content-dim';
          rowsHtml += `
            <tr class="border-b border-border-subtle/80">
              <td class="text-content-secondary py-1 pr-3 whitespace-nowrap">${b.name}</td>
              <td class="text-right px-2 py-1 tabular-nums ${rfClass}">${b.rf.toLocaleString()}</td>
              <td class="text-right pl-2 py-1 tabular-nums ${uaClass}">${b.ua.toLocaleString()}</td>
            </tr>
          `;
        }

        if (!hasRows) {
          rowsHtml = `<tr><td colspan="3" class="text-content-dim py-2 text-center">No verified losses</td></tr>`;
        }

        return `
          <div class="text-xs min-w-[240px] p-0.5">
            <div class="font-bold text-accent-primary text-sm mb-2 pb-1 border-b border-border-subtle/80">
              Period: ${period}
            </div>
            <table class="w-full border-collapse text-[11px]">
              <thead>
                <tr class="text-content-muted border-b border-border-subtle/80">
                  <th class="py-1 pr-3 font-semibold text-left">Category</th>
                  <th class="py-1 px-2 text-right text-status-danger font-bold">RF</th>
                  <th class="py-1 pl-2 text-right text-accent-blue font-bold">UA</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr class="border-t border-border-muted font-bold">
                  <td class="text-content-primary pt-2 pr-3">Total (Month)</td>
                  <td class="text-status-danger text-right px-2 pt-2 tabular-nums">${Number(rfTotal).toLocaleString()}</td>
                  <td class="text-accent-blue text-right pl-2 pt-2 tabular-nums">${Number(uaTotal).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      },
    },
    legend: {},
    grid: {
      bottom: '12%',
    },
    dataZoom: [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: 100,
        bottom: '2%',
      },
      { type: 'inside', xAxisIndex: [0] },
    ],
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: 'Units',
    },
    series: [
      {
        name: 'Russian Federation (RF)',
        type: 'line',
        data: overall_timeline.rf_series,
        smooth: true,
        lineStyle: { width: 3, color: rfColor },
        itemStyle: { color: rfColor },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: 'Ukraine (UA)',
        type: 'line',
        data: overall_timeline.ua_series,
        smooth: true,
        lineStyle: { width: 3, color: uaColor },
        itemStyle: { color: uaColor },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };

  return (
    <section data-anchor-section="losses-timeline" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="losses-timeline">
        <EChart option={timelineChartOption} height="480px" chartId="chart-losses-timeline" />
      </ChartCard>
    </section>
  );
};

export default WarLossesTimelineGraph;
