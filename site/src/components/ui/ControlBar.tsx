import type React from 'react';
import { startTransition, useEffect, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Slider } from '@/components/ui/Slider';
import { TimelineScrubber } from '@/components/ui/TimelineScrubber';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import { cn } from '@/utils/cn';
import type { Control, DashboardToolbarSpec, RangeSliderControl, SliderControl } from '@/utils/project';
import { useFormat, useTranslation } from '@/utils/provider';
import type { ControlStore, State } from '@/utils/store';
import { STICKY_TOOLBAR_DATA_ATTR } from '@/utils/viewport';

interface SliderFieldProps {
  spec: SliderControl;
  value: unknown;
  state?: State;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  className?: string;
}

/** Dedicated throttled numerical slider field avoiding unnecessary passive effect scheduling. */
function SliderField({ spec, value, state, onChange, disabled, className }: SliderFieldProps) {
  const fmt = useFormat();
  const min = typeof spec.min === 'function' ? spec.min(state || {}) : spec.min;
  const max = typeof spec.max === 'function' ? spec.max(state || {}) : spec.max;
  const effectiveMax = Math.max(min, max);
  const debounceMs = spec.debounceMs ?? 0;

  const [dragVal, setDragVal] = useState<number | null>(null);
  const pendingValRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSliderChange = (next: number) => {
    if (!debounceMs) {
      onChange(next);
      return;
    }
    setDragVal(next);
    pendingValRef.current = next;

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingValRef.current !== null) {
          onChange(pendingValRef.current);
        }
      }, debounceMs);
    }
  };

  const handleCommit = (next: number) => {
    if (!debounceMs) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValRef.current = null;
    setDragVal(null);
    onChange(next);
  };

  const rawVal = dragVal ?? Number(value ?? spec.defaultValue);
  const val = Math.min(Math.max(rawVal, min), effectiveMax);
  const minLen = fmt.number(min).length;
  const maxLen = fmt.number(effectiveMax).length;
  const maxChars = Math.max(minLen, maxLen);

  return (
    <div className={cn('control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs', disabled && 'opacity-50 pointer-events-none', className)}>
      {spec.label && (
        <span className="text-content-secondary font-medium whitespace-nowrap">
          {spec.label}:{' '}
          <span style={{ minWidth: `${maxChars}ch` }} className="font-bold text-accent-primary font-mono tabular-nums inline-block text-right">
            {fmt.number(val)}
          </span>
        </span>
      )}
      <div className="w-28 flex items-center">
        <Slider
          min={min}
          max={effectiveMax}
          step={spec.step}
          value={[val]}
          onValueChange={([v]) => handleSliderChange(v)}
          onValueCommit={([v]) => {
            if (v !== undefined) handleCommit(v);
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

interface RangeSliderFieldProps {
  spec: RangeSliderControl;
  value: unknown;
  state?: State;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  className?: string;
}

/** Dedicated throttled numerical dual-handle range slider field. */
function RangeSliderField({ spec, value, state, onChange, disabled, className }: RangeSliderFieldProps) {
  const min = typeof spec.min === 'function' ? spec.min(state || {}) : spec.min;
  const max = typeof spec.max === 'function' ? spec.max(state || {}) : spec.max;
  const effectiveMax = Math.max(min, max);
  const debounceMs = spec.debounceMs ?? 0;

  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  const pendingRangeRef = useRef<[number, number] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleRangeChange = (next: [number, number]) => {
    if (!debounceMs) {
      onChange(next);
      return;
    }
    setDragRange(next);
    pendingRangeRef.current = next;

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRangeRef.current !== null) {
          onChange(pendingRangeRef.current);
        }
      }, debounceMs);
    }
  };

  const handleCommit = (next: [number, number]) => {
    if (!debounceMs) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRangeRef.current = null;
    setDragRange(null);
    onChange(next);
  };

  const rawRange = dragRange ?? ((Array.isArray(value) && value.length === 2 ? value : (spec.defaultValue ?? [min, effectiveMax])) as [number, number]);
  const range: [number, number] = [Math.max(min, Math.min(effectiveMax, rawRange[0])), Math.max(min, Math.min(effectiveMax, rawRange[1]))];
  const minLen = String(min).length;
  const maxLen = String(effectiveMax).length;
  const maxChars = minLen + 3 + maxLen;

  return (
    <div className={cn('control-panel inline-flex items-center gap-2.5 px-3 h-7 text-xs', disabled && 'opacity-50 pointer-events-none', className)}>
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
          min={min}
          max={effectiveMax}
          step={spec.step ?? 1}
          minStepsBetweenThumbs={spec.minStepsBetweenThumbs ?? 0}
          value={range}
          onValueChange={(val) => handleRangeChange(val as [number, number])}
          onValueCommit={(val) => {
            if (Array.isArray(val) && val.length === 2) {
              handleCommit(val as [number, number]);
            }
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

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
  const { t } = useTranslation();
  const isDisabled = overrideDisabled ?? (typeof spec.disabled === 'function' ? (state ? spec.disabled(state) : false) : Boolean(spec.disabled));

  switch (spec.type) {
    case 'slider':
      return <SliderField spec={spec} value={value} state={state} onChange={onChange} disabled={isDisabled} className={className} />;
    case 'range-slider':
      return <RangeSliderField spec={spec} value={value} state={state} onChange={onChange} disabled={isDisabled} className={className} />;
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
      const placeholder = typeof spec.placeholder === 'function' ? spec.placeholder(state || {}) : spec.placeholder;
      const selectedVal = (value ?? spec.defaultValue ?? '') as string | number;
      return (
        <SearchSelect
          mode="single"
          items={items}
          value={selectedVal}
          defaultValue={spec.defaultValue}
          onChange={(val) => onChange(val)}
          onClear={() => onChange(spec.defaultValue ?? '')}
          placeholder={placeholder}
          emptyLabel={spec.emptyLabel}
          className={className}
          disabled={isDisabled}
        />
      );
    }
    case 'multi-search-select': {
      const items = typeof spec.items === 'function' ? spec.items(state || {}) : spec.items;
      const placeholder = typeof spec.placeholder === 'function' ? spec.placeholder(state || {}) : spec.placeholder;
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
          placeholder={placeholder}
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

  const resetButton = (
    <button
      type="button"
      onClick={() => {
        startTransition(() => {
          store.resetState();
        });
      }}
      className={cn(
        'text-xs text-content-muted hover:text-accent-primary transition-opacity underline cursor-pointer select-none whitespace-nowrap',
        !state.hasActiveFilters && 'invisible pointer-events-none',
      )}
    >
      {t.common.reset}
    </button>
  );

  return (
    <div className={cn('control-bar flex flex-col gap-2 w-full min-w-0', className)}>
      {hasCompactControls && (
        <div className="relative w-full text-center min-h-7">
          {/* Row 1 only: Left clearance spacer balancing reset button */}
          <div className="float-left h-7 flex items-center invisible pointer-events-none select-none" aria-hidden="true">
            {resetButton}
          </div>

          {/* Row 1 only: Right-floated reset button */}
          <div className="float-right h-7 flex items-center justify-end shrink-0">{resetButton}</div>

          {/* Inline-level controls: Row 1 flows between floats, Row 2+ flows across full 100% width */}
          {compactControls.map((ctrl) => {
            const isDisabled = typeof ctrl.disabled === 'function' ? ctrl.disabled(state) : Boolean(ctrl.disabled);
            const value = state[ctrl.id];
            return (
              <div key={ctrl.id} className="inline-flex align-middle mx-1 my-0.5">
                <ControlField
                  spec={ctrl}
                  value={value}
                  state={state}
                  onChange={(val) => {
                    startTransition(() => {
                      store.setState(ctrl.onChange ? ctrl.onChange(val, state) : { [ctrl.id]: val });
                    });
                  }}
                  disabled={isDisabled}
                />
              </div>
            );
          })}
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
            onChange={(val) => {
              startTransition(() => {
                store.setState(ctrl.onChange ? ctrl.onChange(val, state) : { [ctrl.id]: val });
              });
            }}
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
    <div {...{ [STICKY_TOOLBAR_DATA_ATTR]: '' }} className="sticky top-16 z-40 glass-bar -mx-6 px-6 py-2 transition-all flex flex-col gap-2">
      {toolbars.map((tb) => (
        <ControlBar key={tb.id} store={stores[tb.id]} controls={tb.controls} />
      ))}
    </div>
  );
};
