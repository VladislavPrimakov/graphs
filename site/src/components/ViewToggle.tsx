import type React from 'react';

/** Option item for the segmented view toggle control. */
export interface ViewToggleOption<T extends string = string> {
  /** Underlying value identifier. */
  value: T;
  /** Display label shown on the toggle button. */
  label: string;
}

/** Props for the segmented view toggle button group component. */
export interface ViewToggleProps<T extends string = string> {
  /** List of selectable view options. */
  options: ViewToggleOption<T>[];
  /** Currently active value. */
  value: T;
  /** Callback fired when the user selects a different view option. */
  onChange: (value: T) => void;
  /** Optional additional CSS class names. @default '' */
  className?: string;
}

/** Segmented toggle button group for switching chart granularities, views, and data dimensions. */
export function ViewToggle<T extends string = string>({ options, value, onChange, className = '' }: ViewToggleProps<T>): React.ReactElement {
  return (
    <div className={`inline-flex items-center gap-1 bg-surface-card border border-border-subtle p-1 rounded-lg ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              isActive ? 'bg-accent-primary text-surface-base shadow-sm' : 'text-content-muted hover:text-content-primary hover:bg-surface-elevated/50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;
