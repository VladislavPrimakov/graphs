import { chartSection, type Project } from '@/types';
import { chartOption, zipRecords } from '@/utils/chart-builder';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

export const project: Project<'space-launches', typeof dict> = {
  ...meta,
  buildSections: ({ data, t, fmt }) => {
    const summary = data.summary;
    const allRegions = data.regions;
    const costRegions = Object.keys(data.decadeCosts.series);

    return [
      chartSection({
        id: 'payload-capacity',
        anchorId: 'payload-capacity',
        title: t.proj.payloadCapacity.title,
        kpisTop: [
          {
            label: t.proj.payloadCapacity.kpis.totalLaunches,
            value: fmt.number(summary.totalAttempts),
            valueColor: 'success',
          },
          {
            label: t.proj.payloadCapacity.kpis.totalPayload,
            value: fmt.unit(summary.totalPayloadTons, 'mass-tonne'),
            valueColor: 'primary',
          },
          {
            label: `${t.proj.payloadCapacity.kpis.leaderShare} (${fmt.region(summary.leaderAllTimeRegion)})`,
            value: `${fmt.unit(summary.leaderAllTimeMassTons, 'mass-tonne')} (${fmt.percent(summary.leaderAllTimeShare)})`,
            valueColor: 'info',
          },
        ],
        controls: [
          {
            id: 'mode',
            type: 'toggle',
            defaultValue: 'value',
            label: t.common.metric,
            options: [
              { value: 'value', label: `${t.common.volume} (${fmt.unitName('mass-tonne', { style: 'short' })})` },
              { value: 'share', label: `${t.common.share} (%)` },
            ],
          },
          {
            id: 'topN',
            type: 'slider',
            min: Math.min(3, allRegions.length),
            max: Math.min(15, allRegions.length),
            defaultValue: Math.min(7, allRegions.length),
            label: t.common.top,
          },
        ] as const,
        buildView: (values) => {
          const isShare = values.mode === 'share';
          const topN = values.topN;
          const activeRegions = allRegions.slice(0, topN);

          const activeYearTotals = data.payloadCapacity.years.map((_, yearIdx) => {
            let mass = 0;
            let launches = 0;
            for (const r of activeRegions) {
              mass += data.payloadCapacity.series[r]?.[yearIdx] || 0;
              launches += data.payloadCapacity.launches?.[r]?.[yearIdx] || 0;
            }
            return {
              mass: Math.round(mass * 10) / 10,
              launches,
            };
          });

          return chartOption({
            title: { text: `${t.proj.payloadCapacity.title} (${t.common.top} ${topN})` },
            dataZoom: [{ type: 'slider' }, { type: 'inside' }],
            tooltip: {
              type: 'axis',
              header: ({ name }) => `${t.common.period}: ${name}`,
              sort: 'desc',
              row: ({ seriesName, data }) => {
                if (data.val <= 0) return undefined;
                const launches = data.launches;
                return {
                  label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
                  value: isShare ? fmt.percent(data.share) : fmt.unit(data.val, 'mass-tonne'),
                  subValue: isShare ? fmt.unit(data.val, 'mass-tonne') : fmt.percent(data.share),
                };
              },
              footer: ({ dataIndex }) => {
                const activeTot = activeYearTotals[dataIndex];
                const totalLaunches = activeTot?.launches || 0;
                const totalPayload = activeTot?.mass || 0;
                const totalLabel = totalLaunches > 0 ? `${t.common.total} (${fmt.number(totalLaunches)})` : t.common.total;
                return {
                  label: totalLabel,
                  value: fmt.unit(totalPayload, 'mass-tonne'),
                };
              },
            },
            xAxis: {
              type: 'category',
              data: data.payloadCapacity.years.map(String),
            },
            yAxis: {
              type: 'value',
              name: isShare ? '%' : fmt.unitName('mass-tonne', { style: 'long' }),
              min: 0,
              max: isShare ? 100 : undefined,
            },
            series: activeRegions.map((region: string) => {
              const valList = data.payloadCapacity.series[region] || [];
              const launchList = data.payloadCapacity.launches?.[region] || [];
              const shareList = valList.map((val, idx) => {
                const tot = activeYearTotals[idx].mass;
                return tot > 0 ? Math.round((val / tot) * 1000) / 10 : 0;
              });

              return {
                id: region,
                name: fmt.region(region),
                type: 'line' as const,
                stack: 'Total',
                showSymbol: false,
                color: fmt.regionColor(region),
                areaStyle: { opacity: 0.85 },
                data: zipRecords({
                  value: isShare ? shareList : valList,
                  val: valList,
                  share: shareList,
                  launches: launchList,
                }),
              };
            }),
          });
        },
      }),
      chartSection({
        id: 'launch-costs',
        anchorId: 'launch-costs',
        title: t.proj.launchCosts.title,
        kpisTop: [
          {
            label: `${t.proj.launchCosts.kpis.bestAvgCost} (${fmt.decade(summary.bestDecadeAvgCostDecade)})`,
            value: fmt.per(fmt.currency(summary.bestDecadeAvgCostPerKg), 'mass-kilogram'),
            valueColor: 'success',
          },
          {
            label: `${t.proj.launchCosts.kpis.costReduction} (${fmt.decade(summary.worstDecadeAvgCostDecade)}: ${fmt.per(fmt.currency(summary.worstDecadeAvgCostPerKg), 'mass-kilogram')} → ${fmt.decade(summary.bestDecadeAvgCostDecade)}: ${fmt.per(fmt.currency(summary.bestDecadeAvgCostPerKg), 'mass-kilogram')})`,
            value: `${summary.costReductionFactor}×`,
            valueColor: 'primary',
          },
          {
            label: `${t.proj.launchCosts.kpis.lowestCost} (${fmt.region(summary.lowestCostRegion)}, ${fmt.decade(summary.lowestCostDecade)})`,
            value: fmt.per(fmt.currency(summary.lowestCostPerKg), 'mass-kilogram'),
            valueColor: 'info',
          },
        ],
        controls: [
          {
            id: 'topN',
            type: 'slider',
            min: Math.min(3, costRegions.length),
            max: Math.min(15, costRegions.length),
            defaultValue: Math.min(7, costRegions.length),
            label: t.common.top,
          },
        ],
        buildView: (values) => {
          const topN = values.topN;
          const activeCostRegions = costRegions.slice(0, topN);

          return chartOption({
            title: { text: `${t.proj.launchCosts.title} (${t.common.top} ${topN})` },
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => {
                const rawDecade = data.decadeCosts.decades[dataIndex];
                return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
              },
              sort: 'asc',
              row: ({ seriesName, value, data }) => {
                if (value <= 0) return undefined;
                const launches = data.launches;
                return {
                  label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
                  value: fmt.currency(value),
                };
              },
              footer: ({ dataIndex }) => {
                const totalLaunches = data.decadeCosts.totalLaunches[dataIndex] || 0;
                const totalAvgCost = data.decadeCosts.totalAvgCost[dataIndex];
                if (totalAvgCost == null) return undefined;
                const totalLabel = totalLaunches > 0 ? `${t.common.average} (${fmt.number(totalLaunches)})` : t.common.average;
                return {
                  label: totalLabel,
                  value: fmt.currency(totalAvgCost),
                };
              },
            },
            xAxis: {
              type: 'category',
              data: data.decadeCosts.decades.map(fmt.decade),
            },
            yAxis: {
              type: 'log',
              logBase: 10,
              name: fmt.per('$', 'mass-kilogram'),
            },
            series: activeCostRegions.map((region: string) => ({
              id: region,
              name: fmt.region(region),
              type: 'bar' as const,
              color: fmt.regionColor(region),
              data: zipRecords({
                value: data.decadeCosts.series[region] || [],
                launches: data.decadeCosts.launches?.[region] || [],
              }),
            })),
          });
        },
      }),
      chartSection({
        id: 'avg-payload',
        anchorId: 'avg-payload',
        title: t.proj.avgPayload.title,
        kpisTop: [
          {
            label: `${t.proj.avgPayload.kpis.bestAvgPayload} (${fmt.decade(summary.bestDecadeAvgPayloadDecade)})`,
            value: fmt.unit(summary.currentDecadeAvgPayloadKg, 'mass-kilogram'),
            valueColor: 'success',
          },
          {
            label: `${t.proj.avgPayload.kpis.payloadGrowth} (${fmt.decade(summary.worstDecadeAvgPayloadDecade)}: ${fmt.unit(summary.baselineAvgPayloadKg, 'mass-kilogram')} → ${fmt.decade(summary.bestDecadeAvgPayloadDecade)}: ${fmt.unit(summary.currentDecadeAvgPayloadKg, 'mass-kilogram')})`,
            value: `${summary.payloadGrowthFactor}×`,
            valueColor: 'primary',
          },
          {
            label: `${t.proj.avgPayload.kpis.heavyClassRecord} (${fmt.region(summary.bestDecadeCountryAvgPayloadRegion)}, ${fmt.decade(summary.bestDecadeCountryAvgPayloadDecade)})`,
            value: fmt.unit(summary.bestDecadeCountryAvgPayloadKg, 'mass-kilogram'),
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
            title: { text: `${t.proj.avgPayload.title} (${t.common.top} ${topN})` },
            tooltip: {
              type: 'axis',
              header: ({ dataIndex }) => {
                const rawDecade = data.avgPayload.decades[dataIndex];
                return `${t.common.period}: ${fmt.decade(String(rawDecade))}`;
              },
              sort: 'desc',
              row: ({ seriesName, value, data }) => {
                if (value <= 0) return undefined;
                const launches = data.launches;
                return {
                  label: launches > 0 ? `${seriesName} (${fmt.number(launches)})` : seriesName,
                  value: fmt.unit(value, 'mass-kilogram'),
                };
              },
              footer: ({ dataIndex }) => {
                const totalLaunches = data.avgPayload.totalLaunches[dataIndex] || 0;
                const totalAvgPayload = data.avgPayload.totalAvgPayload[dataIndex];
                if (totalAvgPayload == null) return undefined;
                const totalLabel = totalLaunches > 0 ? `${t.common.average} (${fmt.number(totalLaunches)})` : t.common.average;
                return {
                  label: totalLabel,
                  value: fmt.unit(totalAvgPayload, 'mass-kilogram'),
                };
              },
            },
            xAxis: {
              type: 'category',
              data: data.avgPayload.decades.map(fmt.decade),
            },
            yAxis: {
              type: 'value',
              name: fmt.per(fmt.unitName('mass-kilogram'), 'event-launch'),
            },
            series: activeRegions.map((region: string) => ({
              id: region,
              name: fmt.region(region),
              type: 'bar' as const,
              color: fmt.regionColor(region),
              data: zipRecords({
                value: data.avgPayload.series[region] || [],
                launches: data.avgPayload.launches?.[region] || [],
              }),
            })),
          });
        },
      }),
      chartSection({
        id: 'failure-rates',
        anchorId: 'failure-rates',
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
              row: ({ seriesName, value, data }) => {
                const { attempts, failures } = data;
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
      }),
    ];
  },
};
