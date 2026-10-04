import type { LineSeriesOption } from 'echarts';
import { chartSection, type Project } from '@/types';
import { chartOption } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

export const project: Project<'world', typeof dict> = {
  ...meta,
  buildSections: ({ data, t, fmt }) => {
    const { years, charts } = data;
    const yearsStr = years.map(String);

    const formatValue = (val: number) => fmt.number(val, val >= 100 ? { maximumFractionDigits: 0 } : undefined);

    const metricConfigs = [
      { id: 'gdp-ppp', title: t.proj.gdpPpp.title, chartData: charts.gdpPpp, unit: `${fmt.scale(1e12)} ($)` },
      { id: 'gdp-per-capita-ppp', title: t.proj.gdpPerCapita.title, chartData: charts.gdpPerCapitaPpp, unit: fmt.per('Int$', 'person') },
      { id: 'machinery-turnover', title: t.proj.machineryTurnover.title, chartData: charts.machineryTurnover, unit: `${fmt.scale(1e9)} ($)` },
      { id: 'electricity-generation', title: t.proj.electricityGeneration.title, chartData: charts.electricityGeneration, unit: fmt.unitName('energy-terawatt-hour') },
      { id: 'clean-power', title: t.proj.cleanPower.title, chartData: charts.cleanPower, unit: fmt.unitName('energy-terawatt-hour') },
      { id: 'electricity-per-capita', title: t.proj.electricityPerCapita.title, chartData: charts.electricityPerCapita, unit: fmt.per(fmt.unitName('energy-kilowatt-hour'), 'person') },
    ];

    return metricConfigs
      .filter((m) => Boolean(m.chartData))
      .map((m) => {
        const unit = m.unit;

        const totalEntities = Object.keys(m.chartData.series).length;

        return chartSection({
          id: m.id,
          anchorId: m.id,
          title: m.title,
          controls: [
            {
              id: 'topN',
              type: 'slider',
              min: Math.min(3, totalEntities),
              max: Math.min(15, totalEntities),
              defaultValue: Math.min(7, totalEntities),
              label: t.common.top,
            },
          ],
          buildView: (values) => {
            const topN = values.topN;
            const activeCodes = Object.keys(m.chartData.series).slice(0, topN);

            const series = activeCodes
              .filter((entityCode) => m.chartData.series[entityCode] != null)
              .map((entityCode): LineSeriesOption => {
                const values = m.chartData.series[entityCode];
                const regionCode = entityCode;
                const name = fmt.region(regionCode);
                const color = fmt.regionColor(regionCode);

                return {
                  id: entityCode,
                  name,
                  type: 'line',
                  color,
                  data: values,
                  endLabel: {
                    show: true,
                    formatter: ({ value, seriesName }) => (typeof value === 'number' ? `${seriesName}: ${formatValue(value)}` : ''),
                  },
                  labelLayout: {
                    moveOverlap: 'shiftY',
                  },
                };
              });

            return chartOption({
              title: { text: `${m.title} (${t.common.top} ${topN})` },
              legend: { show: false },
              tooltip: {
                type: 'axis',
                sort: 'desc',
                row: ({ value }) => ({
                  value: formatValue(value),
                }),
              },
              xAxis: {
                type: 'category',
                data: yearsStr,
              },
              yAxis: {
                type: 'value',
                name: unit,
              },
              series,
            });
          },
        });
      });
  },
};
