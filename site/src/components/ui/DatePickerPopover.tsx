import * as Popover from '@radix-ui/react-popover';
import type React from 'react';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { cn } from '@/utils/cn';
import { useFormat, useTranslation } from '@/utils/provider';

export type DatePickerMode = 'daily' | 'monthly' | 'yearly';

interface DatePickerPopoverProps {
  /** Picker mode: 'daily' (full calendar with days), 'monthly' (12-month year grid), or 'yearly' (12-year decade grid). */
  mode: DatePickerMode;
  /** Current date string (YYYY-MM-DD, YYYY-MM, or YYYY). */
  value: string;
  /** Earliest allowable date (YYYY-MM-DD, YYYY-MM, or YYYY). */
  minDate?: string;
  /** Latest allowable date (YYYY-MM-DD, YYYY-MM, or YYYY). */
  maxDate?: string;
  /** Formatted human-readable date label. */
  label: string;
  /** Callback fired when a new date is selected from the calendar. */
  onSelect: (dateStr: string) => void;
  /** Callback fired when clicking the step previous button. */
  onStepPrev: (e: React.MouseEvent) => void;
  /** Indicates whether stepping back is permitted. */
  canStepPrev: boolean;
  /** Callback fired when clicking the step next button. */
  onStepNext: (e: React.MouseEvent) => void;
  /** Indicates whether stepping forward is permitted. */
  canStepNext: boolean;
  /** Accessible label or title for the date picker trigger. */
  title?: string;
  /** Minimum character width to reserve for the formatted date label preventing layout jitter during scrubber drags. */
  minChars?: number;
}

/** Parses a YYYY-MM-DD, YYYY-MM, or YYYY string into a local Date instance avoiding UTC boundary shifts. */
function parseLocalDate(str: string): Date {
  const parts = str.split('-').map(Number);
  if (parts.length >= 3 && !Number.isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (parts.length >= 2 && !Number.isNaN(parts[1])) {
    return new Date(parts[0], parts[1] - 1, 1);
  }
  if (parts.length >= 1 && !Number.isNaN(parts[0])) {
    return new Date(parts[0], 0, 1);
  }
  return new Date();
}

/** Formats a Date instance into an ISO YYYY-MM-DD string. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Interactive segmented date picker component featuring:
 * - Direct single-unit stepper buttons (‹ and ›) with Shift+click jumping
 * - Radix floating popover housing a full-featured DayPicker or localized Month grid
 * - Quick month and year dropdown navigation
 */
export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({ mode, value, minDate, maxDate, label, onSelect, onStepPrev, canStepPrev, onStepNext, canStepNext, title, minChars }) => {
  const fmt = useFormat();
  const {
    t: { common: tCommon },
  } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const isDaily = mode === 'daily';
  const isYearly = mode === 'yearly';

  const selectedDate = value ? parseLocalDate(value) : undefined;
  const startMonth = isDaily && minDate ? parseLocalDate(minDate) : undefined;
  const endMonth = isDaily && maxDate ? parseLocalDate(maxDate) : undefined;

  const [displayedMonth, setDisplayedMonth] = useState<Date | undefined>(selectedDate);
  const [displayedYear, setDisplayedYear] = useState<number>(selectedDate?.getFullYear() ?? new Date().getFullYear());

  const minYear = minDate ? Number(minDate.slice(0, 4)) : -Infinity;
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : Infinity;
  const minMonth = mode === 'monthly' && minDate ? (minDate.length > 7 ? minDate.slice(0, 7) : minDate) : undefined;
  const maxMonth = mode === 'monthly' && maxDate ? (maxDate.length > 7 ? maxDate.slice(0, 7) : maxDate) : undefined;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      if (isDaily) {
        setDisplayedMonth(selectedDate ?? endMonth ?? startMonth ?? new Date());
      }
      const fallbackYear = maxYear !== Infinity ? maxYear : minYear !== -Infinity ? minYear : new Date().getFullYear();
      setDisplayedYear(selectedDate?.getFullYear() ?? fallbackYear);
    }
  };

  const isDayDisabled = (d: Date) => {
    const iso = toIsoDate(d);
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  const handleDaySelect = (day?: Date) => {
    if (!day) return;
    onSelect(toIsoDate(day));
    setIsOpen(false);
  };

  const decadeStartYear = Math.floor(displayedYear / 10) * 10;
  const stepYear = isYearly ? 10 : 1;
  const canPrevYear = isYearly ? decadeStartYear > minYear : displayedYear > minYear;
  const canNextYear = isYearly ? decadeStartYear + 11 < maxYear : displayedYear < maxYear;
  const headerYearLabel = isYearly ? `${decadeStartYear} – ${decadeStartYear + 11}` : displayedYear;

  const gridItems =
    !isOpen || mode === 'daily'
      ? []
      : Array.from({ length: 12 }, (_, i) => {
          if (isYearly) {
            const year = decadeStartYear + i;
            const yearStr = String(year);
            return {
              key: yearStr,
              label: yearStr,
              isSelected: Boolean(value?.startsWith(yearStr)),
              isDisabled: year < minYear || year > maxYear,
            };
          }
          const monthStr = `${displayedYear}-${String(i + 1).padStart(2, '0')}`;
          return {
            key: monthStr,
            label: fmt.date(new Date(displayedYear, i, 1), { month: 'short' }),
            isSelected: Boolean(value?.startsWith(monthStr)),
            isDisabled: Boolean((minMonth && monthStr < minMonth) || (maxMonth && monthStr > maxMonth)),
          };
        });

  const stepPrevTitle = mode === 'yearly' ? tCommon.previousYearStep : mode === 'monthly' ? tCommon.previousMonth : tCommon.previousDay;
  const stepNextTitle = mode === 'yearly' ? tCommon.nextYearStep : mode === 'monthly' ? tCommon.nextMonth : tCommon.nextDay;

  return (
    <div className="control-panel inline-flex items-center gap-0 p-0 rounded-md shadow-2xs">
      {/* Step Previous Button */}
      <button
        type="button"
        onClick={onStepPrev}
        disabled={!canStepPrev}
        title={stepPrevTitle}
        className="px-1.5 py-1 text-content-secondary hover:text-content-primary hover:bg-surface-elevated disabled:opacity-25 disabled:pointer-events-none rounded-l-md transition-colors cursor-pointer"
      >
        <ChevronLeftIcon className="w-3 h-3" />
      </button>

      {/* Date Trigger with Radix Popover */}
      <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            title={title}
            className={cn(
              'px-2 py-0.5 text-xs font-semibold text-content-primary hover:text-accent-primary hover:bg-surface-elevated/80 flex items-center gap-1.5 transition-colors cursor-pointer border-x border-border-subtle/60',
              isOpen && 'bg-surface-elevated text-accent-primary',
            )}
          >
            <span style={minChars ? { minWidth: `${minChars}ch` } : undefined} className="whitespace-nowrap tabular-nums text-center inline-block">
              {label}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content side="bottom" align="center" sideOffset={6} className="z-50 glass-overlay p-3 animate-in fade-in-0 zoom-in-95 outline-hidden">
            {mode === 'daily' ? (
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDaySelect}
                month={displayedMonth ?? selectedDate}
                onMonthChange={setDisplayedMonth}
                startMonth={startMonth}
                endMonth={endMonth}
                captionLayout="dropdown"
                disabled={isDayDisabled}
              />
            ) : (
              <div className="flex flex-col gap-2 w-52 select-none">
                {/* Decade / Year Header */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setDisplayedYear((y) => y - stepYear)}
                    disabled={!canPrevYear}
                    title={isYearly ? tCommon.previousDecade : tCommon.previousYear}
                    className="p-1 text-content-secondary hover:text-content-primary hover:bg-surface-elevated disabled:opacity-25 disabled:pointer-events-none rounded-md transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-content-primary font-mono">{headerYearLabel}</span>
                  <button
                    type="button"
                    onClick={() => setDisplayedYear((y) => y + stepYear)}
                    disabled={!canNextYear}
                    title={isYearly ? tCommon.nextDecade : tCommon.nextYear}
                    className="p-1 text-content-secondary hover:text-content-primary hover:bg-surface-elevated disabled:opacity-25 disabled:pointer-events-none rounded-md transition-colors cursor-pointer"
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Unified 12-cell Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {gridItems.map(({ key, label: itemLabel, isSelected, isDisabled }) => (
                    <button
                      key={key}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        onSelect(key);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center font-mono capitalize',
                        isSelected ? 'bg-accent-primary text-white dark:text-surface-base font-semibold shadow-xs' : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated',
                        isDisabled && 'opacity-25 pointer-events-none text-content-muted',
                      )}
                    >
                      {itemLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Step Next Button */}
      <button
        type="button"
        onClick={onStepNext}
        disabled={!canStepNext}
        title={stepNextTitle}
        className="px-1.5 py-1 text-content-secondary hover:text-content-primary hover:bg-surface-elevated disabled:opacity-25 disabled:pointer-events-none rounded-r-md transition-colors cursor-pointer"
      >
        <ChevronRightIcon className="w-3 h-3" />
      </button>
    </div>
  );
};
