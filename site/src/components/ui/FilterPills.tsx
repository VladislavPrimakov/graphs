import type React from 'react';
import { cn } from '@/utils/cn';
import { useFormat } from '@/utils/locales';

/** An individual selectable pill item within the filter pill group. */
export interface FilterPillItem<T extends string | number = string | number> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

/** Props for the generic FilterPills multi-select component. */
export interface FilterPillsProps<T extends string | number = string | number> {
  /** Array of items available for selection. */
  items: FilterPillItem<T>[];
  /** Currently selected item IDs. Empty array denotes 'all' active. */
  selected: T[];
  /** Change callback with next selected IDs array. */
  onChange: (selected: T[]) => void;
  /** Label for the 'All' pill. When omitted, 'All' pill is not rendered. */
  allLabel?: React.ReactNode;
  /** Optional count badge for the 'All' pill. */
  allCount?: number;
  /** Optional custom formatter for counts. Defaults to fmt.number(count). */
  formatCount?: (count: number) => string;
  /** Additional container CSS class names. */
  className?: string;
  /** Pill size variant. @default 'md' */
  size?: 'sm' | 'md';
}

/** Generic multi-selection filter pill strip following the additive selection pattern. */
export function FilterPills<T extends string | number = string | number>({ items, selected, onChange, allLabel, allCount, formatCount, className, size = 'md' }: FilterPillsProps<T>) {
  const fmt = useFormat();
  const format = formatCount ?? ((c: number) => fmt.number(c));
  const isAll = selected.length === 0;

  const handleToggle = (id: T) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAll = () => {
    onChange([]);
  };

  const isSmall = size === 'sm';

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {allLabel && (
        <button
          type="button"
          onClick={handleAll}
          className={cn(
            'tag-pill transition-all cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-primary/50',
            isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
            isAll
              ? 'bg-accent-glow text-accent-primary border-accent-primary/40 font-bold shadow-xs'
              : 'bg-surface-base/50 text-content-muted border-border-subtle hover:text-content-primary hover:border-border-muted',
          )}
        >
          <span className="leading-none">{allLabel}</span>
          {allCount !== undefined && <span className="tabular-nums text-[10px] leading-none opacity-75">({format(allCount)})</span>}
        </button>
      )}

      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <button
            key={String(item.id)}
            type="button"
            onClick={() => handleToggle(item.id)}
            className={cn(
              'tag-pill transition-all cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-primary/50',
              isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
              isSelected
                ? 'bg-accent-glow text-accent-primary border-accent-primary/40 font-bold shadow-xs'
                : 'bg-surface-base/50 text-content-muted border-border-subtle hover:text-content-primary hover:border-border-muted',
            )}
          >
            {item.icon && <span className="shrink-0 flex items-center leading-none">{item.icon}</span>}
            <span className="leading-none">{item.label}</span>
            {item.count !== undefined && <span className="tabular-nums text-[10px] leading-none opacity-75">({format(item.count)})</span>}
          </button>
        );
      })}
    </div>
  );
}
