import type { KpiCardSpec, SemanticColor } from '@/types';
import { cn } from '@/utils/cn';
import { resolveColor } from '@/utils/color';
import { useFormat } from '@/utils/provider';

/** Props for rendering metric KPI summary cards. */
export interface KpiCardProps {
  /** Metric name or category description displayed above the numeric value. */
  label: string;
  /** Primary metric value rendered in large bold text (automatically formatted if numeric). */
  value: string | number;
  /** Semantic color variant or custom CSS/Tailwind color string. @default 'default' */
  valueColor?: SemanticColor | (string & {});
  /** Optional additional CSS class names. @default '' */
  className?: string;
}

/** Statistical KPI metric card presenting key summary figures with semantic coloring. */
export const KpiCard: React.FC<KpiCardProps> = ({ label, value, valueColor = 'default', className }) => {
  const fmt = useFormat();
  const { className: colorClass, style: colorStyle } = resolveColor(valueColor);

  return (
    <div className={cn('card-subtle', className)}>
      <div className="text-xs text-content-muted leading-tight font-medium">{label}</div>
      <div className={cn('text-2xl font-bold mt-1 tracking-tight', colorClass)} style={colorStyle}>
        {typeof value === 'number' ? fmt.number(value) : value}
      </div>
    </div>
  );
};

/** Props for the responsive KpiRow layout component. */
export interface KpiRowProps {
  /** Array of KPI metric specifications to render in a horizontal row. */
  kpis: KpiCardSpec[];
  /** Optional additional CSS class names. @default '' */
  className?: string;
}

/** Responsive flex row displaying an array of KPI metric summary cards. */
export const KpiRow: React.FC<KpiRowProps> = ({ kpis, className }) => {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {kpis.map((kpi, idx) => (
        <KpiCard key={kpi.id || `${kpi.label}-${idx}`} label={kpi.label} value={kpi.value} valueColor={kpi.valueColor} className="flex-1 min-w-40" />
      ))}
    </div>
  );
};
