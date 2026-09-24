import type React from 'react';

/** Props for rendering metric KPI summary cards. */
export interface KpiCardProps {
  /** Metric name or category description displayed above the numeric value. */
  label: string;
  /** Primary metric value rendered in large bold text (automatically formatted if numeric). */
  value: string | number;
  /** Secondary explanatory text or contextual sub-label displayed below the value. */
  subtext?: React.ReactNode;
  /** Tailwind text color class or direct CSS color hex string for the metric value. @default 'text-content-primary' */
  valueColor?: string;
  /** Tailwind text color class for the secondary subtext. @default 'text-content-dim' */
  subtextColor?: string;
  /** Optional additional CSS class names. @default '' */
  className?: string;
}

/** Statistical KPI metric card presenting key summary figures with optional subtext and semantic coloring. */
export const KpiCard: React.FC<KpiCardProps> = ({ label, value, subtext, valueColor = 'text-content-primary', subtextColor = 'text-content-dim', className = '' }) => {
  const isDirectColor = valueColor.startsWith('#') || valueColor.startsWith('rgb') || valueColor.startsWith('hsl');

  return (
    <div className={`bg-surface-card/60 border border-border-subtle/80 rounded-xl p-4 ${className}`}>
      <div className="text-xs text-content-muted">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold mt-1 ${isDirectColor ? '' : valueColor}`} style={isDirectColor ? { color: valueColor } : undefined}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtext && <div className={`text-xs mt-1 ${subtextColor}`}>{subtext}</div>}
    </div>
  );
};

export default KpiCard;
