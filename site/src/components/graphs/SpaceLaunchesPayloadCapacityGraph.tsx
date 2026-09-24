import type React from 'react';
import type { CallbackDataParams, EChartsOption, LineSeriesOption, PayloadCapacityData } from '@/types';
import { getCountryColor } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow, createTooltipTotal } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the historical orbital payload capacity stacked chart. */
export interface SpaceLaunchesPayloadCapacityGraphProps {
  /** Optional ordered list of tracked spacefaring regions. */
  regions?: string[];
  /** Annual delivered payload capacity dataset. */
  payload_capacity: PayloadCapacityData;
}

/** Stacked area chart showing annual mass of orbital launch payload capacity delivered to LEO/SSO (metric tons) by nation. */
export const SpaceLaunchesPayloadCapacityGraph: React.FC<SpaceLaunchesPayloadCapacityGraphProps> = ({ regions: regionsProp, payload_capacity }) => {
  const regions = regionsProp || Object.keys(payload_capacity.series);

  const series: LineSeriesOption[] = regions.map((region: string) => ({
    name: region,
    type: 'line',
    stack: 'Total',
    areaStyle: { opacity: 0.85 },
    emphasis: { focus: 'series' },
    showSymbol: false,
    itemStyle: { color: getCountryColor(region) },
    data: payload_capacity.series[region] || [],
  }));

  const payloadChartOption: EChartsOption = {
    title: {
      text: 'Orbital Payload Capacity Delivered by Nation',
      subtext: 'Annual mass to LEO/SSO across 8,000+ orbital launch attempts.',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const year = items[0]?.name;
        let total = 0;
        let res = createTooltipHeader(`Year: ${year}`);
        res += '<div class="space-y-1">';
        const sorted = [...items].sort((a, b) => (Number(b?.value) || 0) - (Number(a?.value) || 0));
        sorted.forEach((item) => {
          const val = Number(item.value) || 0;
          total += val;
          if (val > 0) {
            res += createTooltipRow(String(item.seriesName), val, { dotColor: String(item.color) });
          }
        });
        res += '</div>';
        res += createTooltipTotal('Total Launched', total.toFixed(1));
        return res;
      },
    },
    legend: {
      data: [...regions],
    },
    grid: {
      top: 100,
      left: '3%',
      right: '4%',
      bottom: '14%',
      containLabel: true,
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
      {
        type: 'inside',
        xAxisIndex: [0],
      },
    ],
    xAxis: {
      type: 'category',
      data: payload_capacity.years.map(String),
    },
    yAxis: {
      type: 'value',
      name: 'Payload (tons)',
    },
    series,
  };

  return (
    <section data-anchor-section="payload-capacity" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="payload-capacity">
        <EChart option={payloadChartOption} height="520px" chartId="chart-space-payloads" />
      </ChartCard>
    </section>
  );
};

export default SpaceLaunchesPayloadCapacityGraph;
