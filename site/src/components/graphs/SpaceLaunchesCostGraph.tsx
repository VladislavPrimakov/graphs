import type React from 'react';
import type { BarSeriesOption, CallbackDataParams, DecadeCostsData, EChartsOption } from '@/types';
import { getCountryColor } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the orbital launch cost comparison chart. */
export interface SpaceLaunchesCostGraphProps {
  /** Optional ordered list of tracked spacefaring regions. */
  regions?: string[];
  /** Decade-level launch cost dataset. */
  decade_costs: DecadeCostsData;
}

/** Logarithmic bar chart comparing inflation-adjusted launch cost to LEO ($/kg) across seven decades by spacefaring power. */
export const SpaceLaunchesCostGraph: React.FC<SpaceLaunchesCostGraphProps> = ({ regions: regionsProp, decade_costs }) => {
  const regions = regionsProp || Object.keys(decade_costs.series);

  const costSeries: BarSeriesOption[] = regions.map((region: string) => ({
    name: region,
    type: 'bar',
    data: decade_costs.series[region] || [],
    itemStyle: { color: getCountryColor(region) },
  }));

  const costChartOption: EChartsOption = {
    title: {
      text: 'Orbital Launch Cost to LEO by Decade',
      subtext: 'Inflation-adjusted average cost per kg (2021 USD).',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const decade = items[0]?.name;
        let res = createTooltipHeader(`Decade: ${decade}`);
        res += '<div class="space-y-1">';
        const sorted = items.filter((item) => item.value !== null && item.value !== undefined && Number(item.value) > 0).sort((a, b) => Number(a.value) - Number(b.value));
        sorted.forEach((item) => {
          res += createTooltipRow(String(item.seriesName), Number(item.value), { dotColor: String(item.color) });
        });
        res += '</div>';
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
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: decade_costs.decades,
    },
    yAxis: {
      type: 'log',
      logBase: 10,
      name: 'Cost ($/kg)',
      axisLabel: {
        formatter: (v: number) => `$${Number(v).toLocaleString()}`,
      },
    },
    series: costSeries,
  };

  return (
    <section data-anchor-section="launch-costs" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="launch-costs">
        <EChart option={costChartOption} height="480px" chartId="chart-space-costs" />
      </ChartCard>
    </section>
  );
};

export default SpaceLaunchesCostGraph;
