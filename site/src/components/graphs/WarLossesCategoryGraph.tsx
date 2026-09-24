import type React from 'react';
import type { CallbackDataParams, EChartsOption, LossCategoryChartData, LossCategoryDataPoint } from '@/types';
import { themeColors } from '../../styles/tokens';
import { createTooltipHeader, createTooltipRow, createTooltipTotal } from '../../utils/tooltip';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the equipment losses category comparison chart. */
export interface WarLossesCategoryGraphProps {
  /** Category comparison chart series dataset. */
  category_chart: LossCategoryChartData;
}

/** Comparative bar chart visualizing visually verified military equipment losses (RF vs Ukraine) across 8 heavy combat vehicle categories. */
export const WarLossesCategoryGraph: React.FC<WarLossesCategoryGraphProps> = ({ category_chart }) => {
  const { rf: rfColor, ua: uaColor, rfLight, uaLight } = themeColors.losses;

  const categoryChartOption: EChartsOption = {
    title: {
      text: 'Confirmed Equipment Losses by Category',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const dataObj = items[0]?.data as LossCategoryDataPoint | undefined;
        const labelEn = dataObj?.label_en || items[0]?.name;
        const labelRu = dataObj?.label_ru;
        const ratio = dataObj?.ratio;
        const title = labelRu ? `${labelEn} (${labelRu})` : labelEn;

        let res = createTooltipHeader(title);
        res += '<div class="space-y-1">';
        items.forEach((item: CallbackDataParams) => {
          const itemData = item.data as LossCategoryDataPoint | undefined;
          const val = itemData?.value ?? item.value;
          res += createTooltipRow(String(item.seriesName), Number(val), { dotColor: String(item.color) });
        });
        if (ratio) {
          res += createTooltipTotal('RF / UA Ratio', `${ratio} : 1`, 'text-status-warning');
        }
        res += '</div>';
        return res;
      },
    },
    legend: {},
    grid: {
      top: 100,
      left: '3%',
      right: '4%',
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: category_chart.labels,
      axisLabel: { rotate: 15 },
    },
    yAxis: {
      type: 'value',
      name: 'Units',
    },
    series: [
      {
        name: 'Russian Federation (RF)',
        type: 'bar',
        data: category_chart.rf_series,
        itemStyle: { color: rfColor, borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: rfLight,
          fontSize: 10,
          fontWeight: 'bold',
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
        },
      },
      {
        name: 'Ukraine (UA)',
        type: 'bar',
        data: category_chart.ua_series,
        itemStyle: { color: uaColor, borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: uaLight,
          fontSize: 10,
          fontWeight: 'bold',
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
        },
      },
    ],
  };

  return (
    <section data-anchor-section="category-losses" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="category-losses">
        <EChart option={categoryChartOption} height="480px" chartId="chart-losses-category" />
      </ChartCard>
    </section>
  );
};

export default WarLossesCategoryGraph;
