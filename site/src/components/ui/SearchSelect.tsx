import { Command } from 'cmdk';
import type React from 'react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useFormat } from '@/utils/provider';

/** Option item representation for SearchSelect dropdown. */
export interface SearchSelectItem {
  value: string | number;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SearchSelectBaseProps {
  /** Array of all candidate items. */
  items: readonly SearchSelectItem[] | SearchSelectItem[];
  /** Input placeholder label. */
  placeholder?: string;
  /** Empty state message. */
  emptyLabel?: string;
  /** Additional container CSS class names. */
  className?: string;
  /** Whether the control is disabled. */
  disabled?: boolean;
}

export interface SingleSearchSelectProps extends SearchSelectBaseProps {
  mode: 'single';
  /** Currently selected single value. */
  value?: string | number | null;
  /** Default value used to determine whether selection is non-default. */
  defaultValue?: string | number | null;
  /** Callback fired when an item is selected. */
  onChange: (value: string | number) => void;
  /** Optional callback fired when selection is cleared. */
  onClear?: () => void;
}

export interface MultiSearchSelectProps extends SearchSelectBaseProps {
  mode?: 'multi';
  /** Array of currently selected values. */
  selectedValues: (string | number)[];
  /** Callback fired when an item is selected. */
  onSelect: (value: string | number) => void;
  /** Callback fired when an item is removed. */
  onRemove: (value: string | number) => void;
  /** Callback fired when all items are cleared. */
  onClear: () => void;
  /** Optional label for the 'All' item (e.g. 'All Categories' or 'All'). When clicked, clears selection. */
  allLabel?: string;
  /** Optional total count for the 'All' item. */
  allCount?: number;
}

export type SearchSelectProps = SingleSearchSelectProps | MultiSearchSelectProps;

/**
 * Universal search & autocomplete combobox powered by cmdk.
 * Supports both 'single' (select one item, immediate close) and 'multi' (toggle multiple items with checkboxes).
 */
export const SearchSelect: React.FC<SearchSelectProps> = (props) => {
  const { items, placeholder = 'Select...', emptyLabel = 'No results found', className, disabled = false } = props;
  const isSingle = props.mode === 'single';

  const fmt = useFormat();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown on click outside when opened
  const handleOutsideClick = useEffectEvent((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setQuery('');
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedSet = isSingle ? new Set(props.value != null && props.value !== '' ? [props.value] : []) : new Set(props.selectedValues);

  // In multi mode: prioritize selected items at top, then by count / label
  // In single mode: maintain natural list order (by count descending if present, then label)
  const sortedItems = isOpen
    ? [...items].sort((a, b) => {
        if (!isSingle) {
          const aSel = selectedSet.has(a.value);
          const bSel = selectedSet.has(b.value);
          if (aSel && !bSel) return -1;
          if (!aSel && bSel) return 1;
        }
        if (a.count !== undefined || b.count !== undefined) {
          const diff = (b.count ?? 0) - (a.count ?? 0);
          if (diff !== 0) return diff;
        }
        return a.label.localeCompare(b.label);
      })
    : [];

  let effectiveAllCount: number | undefined;
  if (!isSingle && props.allLabel) {
    effectiveAllCount = props.allCount;
    if (effectiveAllCount === undefined && isOpen) {
      let total = 0;
      let hasCounts = false;
      for (const it of items) {
        if (it.count !== undefined) {
          total += it.count;
          hasCounts = true;
        }
      }
      if (hasCounts) effectiveAllCount = total;
    }
  }

  // Derive input display labels
  let displayPlaceholder = placeholder;
  let inputTitle: string | undefined;
  let singleItem: SearchSelectItem | undefined;

  if (isSingle) {
    singleItem = items.find((it) => it.value === props.value);
    if (singleItem) {
      displayPlaceholder = singleItem.label;
      inputTitle = singleItem.label;
    }
  } else {
    const multiSelected = props.selectedValues;
    if (multiSelected.length === 1) {
      singleItem = items.find((it) => it.value === multiSelected[0]);
      if (singleItem) {
        displayPlaceholder = singleItem.label;
        inputTitle = singleItem.label;
      }
    } else if (multiSelected.length > 1) {
      displayPlaceholder = `${placeholder} (${multiSelected.length})`;
      inputTitle = multiSelected
        .map((val) => items.find((it) => it.value === val)?.label)
        .filter(Boolean)
        .join(', ');
    }
  }

  const hasSelection = isSingle ? props.value != null && props.value !== '' : props.selectedValues.length > 0;
  const isNonDefault = isSingle ? (props.defaultValue !== undefined ? props.value !== props.defaultValue && props.value != null && props.value !== '' : hasSelection) : props.selectedValues.length > 0;
  const isClearVisible = Boolean(query) || isNonDefault;

  return (
    <div ref={containerRef} className={cn('relative w-52 shrink-0', disabled && 'opacity-50 pointer-events-none', className)}>
      <Command
        shouldFilter={true}
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
          }
        }}
      >
        <div className="control-panel relative flex items-center justify-between gap-1.5 px-2.5 h-7 text-xs">
          {singleItem?.icon && !query && <span className="shrink-0 flex items-center mr-0.5">{singleItem.icon}</span>}
          <Command.Input
            value={query}
            disabled={disabled}
            onValueChange={(val) => {
              setQuery(val);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
            }}
            placeholder={displayPlaceholder}
            title={inputTitle}
            className={cn(
              'bg-transparent text-content-primary text-xs w-full focus:outline-hidden p-0 m-0',
              hasSelection && !query ? 'placeholder:text-accent-primary placeholder:font-bold' : 'placeholder:text-content-muted font-normal',
            )}
          />
          <button
            type="button"
            disabled={disabled || !isClearVisible}
            tabIndex={isClearVisible ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              if (query) {
                setQuery('');
              } else if (isSingle) {
                props.onClear?.();
              } else {
                props.onClear();
              }
            }}
            className={cn('text-content-muted hover:text-accent-primary shrink-0 cursor-pointer text-sm leading-none p-0.5', !isClearVisible && 'invisible pointer-events-none')}
            aria-label="Clear"
          >
            &times;
          </button>
        </div>

        {isOpen && (
          <Command.List className="glass-overlay absolute top-full left-0 right-0 mt-1 z-40 max-h-60 overflow-y-auto p-1 shadow-2xl rounded-lg">
            <Command.Empty className="px-3 py-2 text-xs text-content-muted text-center">{emptyLabel}</Command.Empty>
            {!isSingle && props.allLabel && (
              <Command.Item
                key="__all__"
                value={props.allLabel}
                title={effectiveAllCount !== undefined ? `${props.allLabel} (${fmt.number(effectiveAllCount)})` : props.allLabel}
                onSelect={() => {
                  props.onClear();
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer transition-colors outline-hidden select-none border-b border-border-subtle/40 mb-1',
                  'text-content-primary data-[selected=true]:bg-surface-elevated',
                  props.selectedValues.length === 0 && 'bg-accent-glow text-accent-primary font-bold shadow-xs',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 mr-2">
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 text-3xs leading-none transition-colors',
                      props.selectedValues.length === 0 ? 'border-accent-primary bg-accent-primary text-surface-base font-bold' : 'border-border-subtle bg-surface-card',
                    )}
                  >
                    {props.selectedValues.length === 0 ? '✓' : ''}
                  </div>
                  <span className="truncate">{props.allLabel}</span>
                </div>
                {effectiveAllCount !== undefined && <span className="font-mono text-3xs text-content-muted shrink-0 tabular-nums">{fmt.number(effectiveAllCount)}</span>}
              </Command.Item>
            )}
            {sortedItems.map((item) => {
              const isSelected = selectedSet.has(item.value);
              const itemTitle = item.count !== undefined ? `${item.label} (${fmt.number(item.count)})` : item.label;
              return (
                <Command.Item
                  key={String(item.value)}
                  value={typeof item.value === 'string' ? `${item.label} ${item.value}` : item.label}
                  title={itemTitle}
                  onSelect={() => {
                    if (isSingle) {
                      props.onChange(item.value);
                      setIsOpen(false);
                      setQuery('');
                    } else if (isSelected) {
                      props.onRemove(item.value);
                    } else {
                      props.onSelect(item.value);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer transition-colors outline-hidden select-none',
                    'text-content-primary data-[selected=true]:bg-surface-elevated',
                    isSelected && 'bg-accent-glow text-accent-primary font-bold shadow-xs',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    {!isSingle && (
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 text-3xs leading-none transition-colors',
                          isSelected ? 'border-accent-primary bg-accent-primary text-surface-base font-bold' : 'border-border-subtle bg-surface-card',
                        )}
                      >
                        {isSelected ? '✓' : ''}
                      </div>
                    )}
                    {item.icon && <span className="shrink-0 flex items-center opacity-70">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && <span className="font-mono text-3xs text-content-muted shrink-0 tabular-nums">{fmt.number(item.count)}</span>}
                </Command.Item>
              );
            })}
          </Command.List>
        )}
      </Command>
    </div>
  );
};
