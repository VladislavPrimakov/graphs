import type React from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Slider } from '@/components/ui/Slider';
import { TimelineScrubber } from '@/components/ui/TimelineScrubber';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import { cn } from '@/utils/cn';
import type { Control, DashboardToolbarSpec } from '@/utils/project';
import { useFormat, useTranslation } from '@/utils/provider';
import type { ControlStore, State } from '@/utils/store';
import { STICKY_TOOLBAR_DATA_ATTR } from '@/utils/viewport';

interface ControlFieldProps {
  spec: Control;
  value: unknown;
  state?: State;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  className?: string;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

/** Individual polymorphic interactive field renderer for sliders, toggles, checkboxes, and search selectors. */
function ControlField({ spec, value, state, onChange, disabled: overrideDisabled, className, onReset, hasActiveFilters }: ControlFieldProps) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const isDisabled = overrideDisabled ?? Boolean(spec.disabled);

  switch (spec.type) {
    case 'slider': {
      const val = Number(value ?? spec.defaultValue);
      const minLen = fmt.number(spec.min).length;
      const maxLen = fmt.number(spec.max).length;
      const maxChars = Math.max(minLen, maxLen);
      return (
        <div className={cn('control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs', isDisabled && 'opacity-50 pointer-events-none', className)}>
          {spec.label && (
            <span className="text-content-secondary font-medium whitespace-nowrap">
              {spec.label}:{' '}
              <span style={{ minWidth: `${maxChars}ch` }} className="font-bold text-accent-primary font-mono tabular-nums inline-block text-right">
                {fmt.number(val)}
              </span>
            </span>
          )}
          <div className="w-28 flex items-center">
            <Slider min={spec.min} max={spec.max} step={spec.step} value={[val]} onValueChange={([v]) => onChange(v)} disabled={isDisabled} />
          </div>
        </div>
      );
    }
    case 'range-slider': {
      const range = (Array.isArray(value) && value.length === 2 ? value : (spec.defaultValue ?? [spec.min, spec.max])) as [number, number];
      const minLen = fmt.number(spec.min).length;
      const maxLen = fmt.number(spec.max).length;
      const maxChars = minLen + 3 + maxLen;
      return (
        <div className={cn('control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs', isDisabled && 'opacity-50 pointer-events-none', className)}>
          {spec.label && (
            <span className="text-content-secondary font-medium whitespace-nowrap">
              {spec.label}:{' '}
              <span style={{ minWidth: `${maxChars}ch` }} className="font-bold text-accent-primary font-mono tabular-nums inline-block text-center">
                {range[0]} – {range[1]}
              </span>
            </span>
          )}
          <div className="w-32 flex items-center">
            <Slider
              min={spec.min}
              max={spec.max}
              step={spec.step ?? 1}
              minStepsBetweenThumbs={spec.minStepsBetweenThumbs ?? 0}
              value={range}
              onValueChange={(val) => onChange(val as [number, number])}
              disabled={isDisabled}
            />
          </div>
        </div>
      );
    }
    case 'toggle': {
      const val = String(value ?? spec.defaultValue);
      const options = typeof spec.options === 'function' ? spec.options(state || {}) : spec.options;
      return (
        <ToggleGroup
          type="single"
          value={val}
          onValueChange={(v) => {
            if (v) onChange(v);
          }}
          className={cn(isDisabled && 'opacity-50 pointer-events-none', className)}
        >
          {options.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} disabled={isDisabled}>
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    }
    case 'checkbox': {
      const isChecked = Boolean(value ?? spec.defaultValue);
      const controlId = `ctrl-${spec.id}`;
      return (
        <div className={cn('control-panel inline-flex items-center gap-2 px-2.5 h-7 text-xs select-none', isDisabled && 'opacity-50 pointer-events-none', className)}>
          <Checkbox id={controlId} checked={isChecked} onCheckedChange={(c) => onChange(Boolean(c))} disabled={isDisabled} />
          {spec.label && (
            <label htmlFor={controlId} className="text-content-secondary font-medium cursor-pointer whitespace-nowrap">
              {spec.label}
            </label>
          )}
        </div>
      );
    }
    case 'single-search-select': {
      const items = typeof spec.items === 'function' ? spec.items(state || {}) : spec.items;
      const selectedVal = (value ?? spec.defaultValue ?? '') as string | number;
      return (
        <SearchSelect
          mode="single"
          items={items}
          value={selectedVal}
          onChange={(val) => onChange(val)}
          onClear={() => onChange(spec.defaultValue ?? '')}
          placeholder={spec.placeholder}
          emptyLabel={spec.emptyLabel}
          className={className}
          disabled={isDisabled}
        />
      );
    }
    case 'multi-search-select': {
      const items = typeof spec.items === 'function' ? spec.items(state || {}) : spec.items;
      const allCount = typeof spec.allCount === 'function' ? spec.allCount(state || {}) : spec.allCount;
      const selected = (Array.isArray(value) ? value : (spec.defaultValue ?? [])) as (string | number)[];
      return (
        <SearchSelect
          mode="multi"
          items={items}
          selectedValues={selected}
          onSelect={(val) => {
            if (!selected.includes(val)) {
              onChange([...selected, val]);
            }
          }}
          onRemove={(val) => onChange(selected.filter((v) => v !== val))}
          onClear={() => onChange([])}
          placeholder={spec.placeholder}
          emptyLabel={spec.emptyLabel}
          allLabel={spec.allLabel ?? t.common.all}
          allCount={allCount}
          className={className}
          disabled={isDisabled}
        />
      );
    }
    case 'timeline-scrubber': {
      const range = (Array.isArray(value) && value.length === 2 ? value : (spec.defaultValue ?? [spec.periods[0], spec.periods[spec.periods.length - 1]])) as [string, string];
      return (
        <div className={cn('control-panel px-3 py-1.5 w-full', isDisabled && 'opacity-50 pointer-events-none', className)}>
          <TimelineScrubber
            granularity={spec.granularity}
            periods={spec.periods as string[]}
            density={spec.density as number[] | undefined}
            dateFrom={range[0]}
            dateTo={range[1]}
            onChange={({ dateFrom, dateTo }) => onChange([dateFrom, dateTo])}
            onReset={onReset}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      );
    }
  }
}

/** Props for the ControlBar component. */
export interface ControlBarProps {
  /** Reactive state store backing the interactive controls. */
  store: ControlStore;
  /** Array of control specifications to render. */
  controls: readonly Control[] | Control[];
  /** Optional container CSS class name. */
  className?: string;
}

/**
 * Universal interactive control bar rendering declarative chart and dashboard controls
 * horizontally centered with responsive wrapping and automated reset triggers.
 */
export function ControlBar({ store, controls, className }: ControlBarProps): React.ReactNode {
  const { t } = useTranslation();
  const state = store.useStore();

  if (!controls.length) return null;

  const compactControls = controls.filter((c) => c.type !== 'timeline-scrubber');
  const fullWidthControls = controls.filter((c) => c.type === 'timeline-scrubber');
  const hasCompactControls = compactControls.length > 0;

  return (
    <div className={cn('control-bar flex flex-col gap-2 w-full min-w-0', className)}>
      {hasCompactControls && (
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-start w-full gap-2 min-w-0">
          {/* Desktop spacer keeping center column mathematically centered */}
          <div className="hidden sm:block" aria-hidden="true" />

          {/* Centered controls that wrap internally */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 min-w-0">
            {compactControls.map((ctrl) => {
              const isDisabled = typeof ctrl.disabled === 'function' ? ctrl.disabled(state) : Boolean(ctrl.disabled);
              const value = state[ctrl.id];
              return <ControlField key={ctrl.id} spec={ctrl} value={value} state={state} onChange={(val) => store.setState({ [ctrl.id]: val })} disabled={isDisabled} />;
            })}
          </div>

          {/* Right-aligned reset button staying on row 1 */}
          <div className="flex justify-end items-center h-7 shrink-0">
            <button
              type="button"
              onClick={store.resetState}
              className={cn(
                'text-xs text-content-muted hover:text-accent-primary transition-opacity underline cursor-pointer select-none whitespace-nowrap',
                !state.hasActiveFilters && 'invisible pointer-events-none',
              )}
            >
              {t.common.reset}
            </button>
          </div>
        </div>
      )}

      {fullWidthControls.map((ctrl) => {
        const isDisabled = typeof ctrl.disabled === 'function' ? ctrl.disabled(state) : Boolean(ctrl.disabled);
        const value = state[ctrl.id];
        return (
          <ControlField
            key={ctrl.id}
            spec={ctrl}
            value={value}
            state={state}
            onChange={(val) => store.setState({ [ctrl.id]: val })}
            disabled={isDisabled}
            onReset={!hasCompactControls ? store.resetState : undefined}
            hasActiveFilters={!hasCompactControls ? Boolean(state.hasActiveFilters) : undefined}
          />
        );
      })}
    </div>
  );
}

/** Props for the DashboardToolbars component. */
export interface DashboardToolbarsProps {
  /** Array of dashboard toolbar specifications. */
  toolbars: readonly DashboardToolbarSpec[] | DashboardToolbarSpec[];
  /** Reactive filter stores indexed by toolbar ID. */
  stores: Record<string, ControlStore>;
}

/**
 * Universal sticky dashboard filter toolbars rendering synchronized interactive controls
 * inside a single shared sticky wrapper to prevent CSS sticky overlapping.
 */
export const DashboardToolbars: React.FC<DashboardToolbarsProps> = ({ toolbars, stores }) => {
  return (
    <div {...{ [STICKY_TOOLBAR_DATA_ATTR]: '' }} className="sticky top-16 z-30 glass-bar -mx-6 px-6 py-2 transition-all flex flex-col gap-2">
      {toolbars.map((tb) => (
        <ControlBar key={tb.id} store={stores[tb.id]} controls={tb.controls} />
      ))}
    </div>
  );
};
