import type React from 'react';
import type { CallbackDataParams, EChartsOption, PartnerBreakdownItem, TradeSeriesDataPoint, UaTradeData } from '@/types';
import { themeColors } from '../../styles/tokens';
import { ChartCard } from '../ChartCard';
import { EChart } from '../EChart';

/** Props for the Ukraine foreign trade structure and balance chart. */
export interface UaEconomicTradeStructureGraphProps {
  /** Foreign trade annual dataset including export/import breakdowns and net deficit. */
  trade: UaTradeData;
}

/** Mixed bar and line chart visualizing annual export and import volumes by partner alongside Ukraine's net trade balance (Billion USD). */
export const UaEconomicTradeStructureGraph: React.FC<UaEconomicTradeStructureGraphProps> = ({ trade }) => {
  const tradeColors = themeColors.trade;
  const tradeYears = trade.years.map(String);

  const exportsSeriesData: TradeSeriesDataPoint[] = trade.total_exports.map((total: number, idx: number) => ({
    value: total,
    total,
    partners: trade.exports_breakdown?.[idx] || [],
  }));

  const importsSeriesData: TradeSeriesDataPoint[] = trade.total_imports.map((total: number, idx: number) => ({
    value: total,
    total,
    partners: trade.imports_breakdown?.[idx] || [],
  }));

  const tradeChartOption: EChartsOption = {
    title: {
      text: 'Foreign Trade Structure & Balance',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return '';
        const year = items[0]?.name;
        let expItem: TradeSeriesDataPoint | null = null;
        let impItem: TradeSeriesDataPoint | null = null;
        let balanceVal: number | null = null;

        for (const item of items) {
          const name = item.seriesName;
          if (name === 'Exports') {
            expItem = item.data as TradeSeriesDataPoint;
          } else if (name === 'Imports') {
            impItem = item.data as TradeSeriesDataPoint;
          } else if (name?.includes('Balance')) {
            balanceVal = Number(item.value);
          }
        }

        const expTotal = expItem?.total ?? Number(expItem?.value ?? 0);
        const impTotal = impItem?.total ?? Number(impItem?.value ?? 0);
        const exportsPartners: PartnerBreakdownItem[] = expItem?.partners || [];
        const importsPartners: PartnerBreakdownItem[] = impItem?.partners || [];

        let res = `<div class="font-bold text-accent-primary text-sm mb-2 pb-1 border-b border-border-subtle">Year: ${year}</div>`;

        // Exports section
        res += `<div class="mb-2">
          <div class="text-accent-blue font-bold text-[11px] uppercase tracking-wider flex justify-between mb-1">
            <span>Exports</span>
            <span>${expTotal.toFixed(1)}</span>
          </div>
          <div class="flex flex-col gap-0.5">`;
        exportsPartners.forEach((it: PartnerBreakdownItem) => {
          res += `<div class="flex justify-between items-center text-xs gap-4">
            <span class="text-content-secondary font-medium">${it.name}</span>
            <span class="text-content-primary font-bold">${it.value.toFixed(1)} <span class="text-content-muted font-normal">(${it.pct}%)</span></span>
          </div>`;
        });
        res += `</div></div>`;

        // Imports section
        res += `<div class="mb-2">
          <div class="text-accent-orange font-bold text-[11px] uppercase tracking-wider flex justify-between mb-1">
            <span>Imports</span>
            <span>${impTotal.toFixed(1)}</span>
          </div>
          <div class="flex flex-col gap-0.5">`;
        importsPartners.forEach((it: PartnerBreakdownItem) => {
          res += `<div class="flex justify-between items-center text-xs gap-4">
            <span class="text-content-secondary font-medium">${it.name}</span>
            <span class="text-content-primary font-bold">${it.value.toFixed(1)} <span class="text-content-muted font-normal">(${it.pct}%)</span></span>
          </div>`;
        });
        res += `</div></div>`;

        // Trade Balance section
        if (balanceVal !== null && balanceVal !== undefined && !Number.isNaN(balanceVal)) {
          const sign = balanceVal > 0 ? '+' : '';
          const balColorClass = balanceVal < 0 ? 'text-status-danger' : 'text-status-success';
          res += `<div class="mt-2 pt-1.5 border-t border-border-subtle flex justify-between items-center text-xs font-bold">
            <span class="text-content-secondary">Trade Balance:</span>
            <span class="${balColorClass} font-extrabold">${sign}${balanceVal.toFixed(1)}</span>
          </div>`;
        }

        return res;
      },
    },
    legend: {
      data: ['Exports', 'Imports', 'Trade Balance (Exports - Imports)'],
    },
    grid: {
      bottom: '10%',
    },
    xAxis: {
      type: 'category',
      data: tradeYears,
      axisLabel: { fontSize: 13, fontWeight: 'bold' },
      axisLine: { onZero: false },
    },
    yAxis: {
      type: 'value',
      name: 'Billion USD ($)',
      min: -60,
      max: 100,
      interval: 20,
    },
    series: [
      {
        name: 'Exports',
        type: 'bar',
        data: exportsSeriesData,
        itemStyle: {
          color: tradeColors.exportTotal,
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          distance: 6,
          color: tradeColors.exportTotal,
          fontSize: 13,
          fontWeight: 'bold',
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
          formatter: (params: CallbackDataParams) => {
            return Number(params.value).toFixed(1);
          },
        },
      },
      {
        name: 'Imports',
        type: 'bar',
        data: importsSeriesData,
        itemStyle: {
          color: tradeColors.importTotal,
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          distance: 6,
          color: tradeColors.importTotal,
          fontSize: 13,
          fontWeight: 'bold',
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
          formatter: (params: CallbackDataParams) => {
            return Number(params.value).toFixed(1);
          },
        },
      },
      {
        name: 'Trade Balance (Exports - Imports)',
        type: 'line',
        data: trade.trade_balance,
        itemStyle: { color: tradeColors.balanceLine },
        lineStyle: { width: 3, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 8,
        label: {
          show: true,
          position: 'bottom',
          distance: 8,
          color: themeColors.text.primary,
          fontSize: 12,
          fontWeight: 'bold',
          textBorderColor: themeColors.surface.card,
          textBorderWidth: 2,
          formatter: (params: CallbackDataParams) => {
            const num = Number(params.value);
            return `${num > 0 ? '+' : ''}${num.toFixed(1)}`;
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 0 }],
          lineStyle: {
            color: themeColors.border.active,
            width: 1.5,
            type: 'solid',
          },
          label: { show: false },
        },
      },
    ],
  };

  return (
    <section data-anchor-section="trade-structure" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard anchorId="trade-structure">
        <EChart option={tradeChartOption} height="500px" chartId="chart-ua-trade" />
      </ChartCard>
    </section>
  );
};

export default UaEconomicTradeStructureGraph;
