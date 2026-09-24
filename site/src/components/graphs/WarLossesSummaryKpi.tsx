import type React from 'react';
import type { LossSummaryData } from '@/types';
import { themeColors } from '../../styles/tokens';
import { KpiCard } from '../KpiCard';

/** Props for the top-level equipment losses summary KPI panel. */
export interface WarLossesSummaryKpiProps {
  /** Summary KPI metrics dataset. */
  summary: LossSummaryData;
}

/** KPI panel presenting top-level verified Russian and Ukrainian equipment losses, overall loss ratio, and database records. */
export const WarLossesSummaryKpi: React.FC<WarLossesSummaryKpiProps> = ({ summary }) => {
  const { rf: rfColor, ua: uaColor } = themeColors.losses;

  return (
    <section data-anchor-section="summary-kpi" className="scroll-mt-20 sm:scroll-mt-24">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Russian Federation Losses" value={summary.total_rf} valueColor={rfColor} subtext="Verified equipment units" />
        <KpiCard label="Ukraine Losses" value={summary.total_ua} valueColor={uaColor} subtext="Verified equipment units" />
        <KpiCard label="RF / UA Overall Ratio" value={`${summary.overall_ratio} : 1`} valueColor={themeColors.status.warning} subtext="Total relative loss ratio" />
        <KpiCard label="Total Database Records" value={summary.total_records} valueColor={themeColors.text.primary} subtext={`Includes ${summary.total_unknown} unclassified`} />
      </div>
    </section>
  );
};

export default WarLossesSummaryKpi;
