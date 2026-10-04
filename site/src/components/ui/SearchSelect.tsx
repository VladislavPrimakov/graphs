import { Command } from 'cmdk';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useFormat } from '@/utils/locales';

/** Option item representation for SearchSelect dropdown. */
export interface SearchSelectItem {
  value: string | number;
  label: string;
  count?: number;
}

/** Component properties for SearchSelect autocomplete input. */
export interface SearchSelectProps {
  /** Array of all searchable candidate items. */
  items: SearchSelectItem[];
  /** Callback fired when an item is selected from the dropdown. */
  onSelect: (item: SearchSelectItem) => void;
  /** Input placeholder label. */
  placeholder?: string;
  /** Empty state message when no items match search query. */
  emptyLabel?: string;
  /** Optional array of already selected item values for active highlighting. */
  selectedValues?: (string | number)[];
  /** Additional container CSS class names. */
  className?: string;
}

/**
 * Searchable autocomplete combobox built on cmdk with glassmorphic styling,
 * keyboard arrow navigation, and design token integration.
 */
export const SearchSelect: React.FC<SearchSelectProps> = ({ items, onSelect, placeholder, emptyLabel = 'No results found', selectedValues = [], className }) => {
  const fmt = useFormat();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (item: SearchSelectItem) => {
    onSelect(item);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <Command
        shouldFilter={true}
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        <div className="control-panel relative flex items-center gap-2 px-3 h-9 text-xs">
          <Command.Input
            value={query}
            onValueChange={(val) => {
              setQuery(val);
              setIsOpen(Boolean(val.trim()));
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="bg-transparent text-content-primary placeholder:text-content-muted text-xs w-full focus:outline-hidden p-0 m-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="text-content-muted hover:text-content-primary shrink-0 cursor-pointer text-sm leading-none"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {isOpen && query.trim() && (
          <Command.List className="glass-overlay absolute top-full left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto p-1 shadow-2xl">
            <Command.Empty className="px-3 py-2 text-xs text-content-muted text-center">{emptyLabel}</Command.Empty>
            {items.map((item) => {
              const isSelected = selectedValues.includes(item.value);
              return (
                <Command.Item
                  key={String(item.value)}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors outline-hidden select-none',
                    'text-content-primary data-[selected=true]:bg-surface-elevated',
                    isSelected && 'bg-accent-glow text-accent-primary font-bold shadow-xs',
                  )}
                >
                  <span className="truncate mr-2">{item.label}</span>
                  {item.count !== undefined && <span className="font-mono text-[10px] text-content-muted shrink-0">{fmt.number(item.count)}</span>}
                </Command.Item>
              );
            })}
          </Command.List>
        )}
      </Command>
    </div>
  );
};
