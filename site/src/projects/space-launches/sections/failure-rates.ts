import { chartSection, type SectionBuilder } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from '../locales/dict-en';

/** Section builder for Launch Failure Rates by Decade chart. */
export const failureRatesSection: SectionBuilder<'space-launches', typeof dict> = ({ data, t, fmt }) => {
  const summary = data.summary;
  const allRegions = data.regions;

  return chartSection({
    id: 'failure-rates',
    title: t.proj.failureRates.title,
    kpisTop: [
      {
        label: t.proj.failureRates.kpis.globalSuccessRate,
        value: fmt.percent(summary.globalSuccessRate),
        valueColor: 'success',
      },
      {
        label: `${t.proj.failureRates.kpis.reliabilityGrowth} (${fmt.decade(summary.worstDecadeReliabilityDecade)}: ${fmt.percent(summary.worstDecadeReliabilityRate)} → ${fmt.decade(summary.bestDecadeGlobalReliabilityDecade)}: ${fmt.percent(summary.bestDecadeGlobalReliabilityRate)})`,
        value: `${summary.reliabilityGrowthFactor}×`,
        valueColor: 'primary',
      },
      {
        label: `${t.proj.failureRates.kpis.bestDecadeReliability} (${fmt.region(summary.bestDecadeReliabilityRegion)}, ${fmt.decade(summary.bestDecadeReliabilityDecade)})`,
        value: fmt.percent(summary.bestDecadeReliabilityRate),
        valueColor: 'info',
      },
    ],
    controls: [
      {
        id: 'topN',
        type: 'slider',
        min: Math.min(3, allRegions.length),
        max: Math.min(15, allRegions.length),
        defaultValue: Math.min(7, allRegions.length),
        label: t.common.top,
      },
    ],
    buildView: (values) => {
      const topN = values.topN;
      const activeRegions = allRegions.slice(0, topN);

      return chartOption({
        title: { text: `${t.proj.failureRates.title} (${t.common.top} ${topN})` },
        tooltip: {
          type: 'axis',
          header: ({ dataIndex }) => {
            const rawDecade = data.failureRates.decades[dataIndex];
            return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
          },
          sort: 'desc',
          row: ({ seriesName, value, data: pointData }) => {
            const { attempts, failures } = pointData;
            const label = attempts > 0 ? `${seriesName} (${fmt.number(failures)}/${fmt.number(attempts)})` : seriesName;
            return {
              label,
              value: fmt.percent(value),
            };
          },
          footer: ({ dataIndex }) => {
            const totalAttempts = data.failureRates.totalAttempts[dataIndex] || 0;
            const totalFailures = data.failureRates.totalFailures[dataIndex] || 0;
            const totalRate = data.failureRates.totalFailureRate[dataIndex];
            if (totalRate == null) return undefined;
            const totalLabel = totalAttempts > 0 ? `${t.common.total} (${fmt.number(totalFailures)}/${fmt.number(totalAttempts)})` : t.common.total;
            return {
              label: totalLabel,
              value: fmt.percent(totalRate),
              color: 'warning',
            };
          },
        },
        xAxis: {
          type: 'category',
          data: data.failureRates.decades.map(fmt.decade),
        },
        yAxis: {
          type: 'value',
          name: '%',
        },
        series: activeRegions.map((region: string) => ({
          id: region,
          name: fmt.region(region),
          type: 'bar' as const,
          color: fmt.regionColor(region),
          data: zipRecords({
            value: data.failureRates.series[region] || [],
            attempts: data.failureRates.attempts?.[region] || [],
            failures: data.failureRates.failures?.[region] || [],
          }),
        })),
      });
    },
  });
};
