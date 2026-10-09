import type React from 'react';
import { useState } from 'react';
import { ChevronDownIcon, ExpandArrowsIcon } from '@/components/icons';
import { SectionHeader } from '@/components/sections/SectionHeader';
import type { BreakdownGridSpec } from '@/types';
import { cn } from '@/utils/cn';
import { useFormat, useTranslation } from '@/utils/provider';

/** Props for the generic categorized SectionBreakdown component. */
export interface SectionBreakdownProps {
  /** Specification declaring categories, comparison lists, and layout parameters. */
  spec: BreakdownGridSpec;
  /** Optional section dataset passed to dynamic category builders. */
  data?: unknown;
  /** Unique project slug identifier for anchor links. */
  projectSlug?: string;
}

/** Generic categorized breakdown grid presenting multi-entity item comparisons with responsive flexbox card layout and accordion expansion. */
export const SectionBreakdown: React.FC<SectionBreakdownProps> = ({ spec, data, projectSlug }) => {
  const { id, previewLimit = 5 } = spec;
  const categories = typeof spec.categories === 'function' ? spec.categories(data) : spec.categories;
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const { t } = useTranslation();
  const fmt = useFormat();

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const expandableCategories = categories.filter((cat) => cat.lists.some((list) => list.items.length > previewLimit));
  const allExpanded = expandableCategories.length > 0 && expandableCategories.every((cat) => expandedCategories[cat.id]);

  const toggleAllCategories = () => {
    const nextState = !allExpanded;
    const update: Record<string, boolean> = {};
    expandableCategories.forEach((cat) => {
      update[cat.id] = nextState;
    });
    setExpandedCategories(update);
  };

  return (
    <>
      <SectionHeader
        sectionId={id}
        projectSlug={projectSlug}
        title={spec.title}
        actions={
          expandableCategories.length > 0 ? (
            <button type="button" onClick={toggleAllCategories} className="btn-subtle">
              <ExpandArrowsIcon className="w-3.5 h-3.5 text-accent-primary" />
              <span className="hidden sm:inline">{allExpanded ? t.common.collapseAllCategories : t.common.expandAllCategories}</span>
              <span className="sm:hidden">{allExpanded ? t.common.collapse : t.common.expandAll}</span>
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-4 items-start">
        {categories.map((cat) => {
          const isExpanded = Boolean(expandedCategories[cat.id]);
          const maxItems = Math.max(...cat.lists.map((l) => l.items.length), 0);
          const hasMore = maxItems > previewLimit;

          return (
            <div key={cat.id} className="card-subtle flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2 mb-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.icon && <span className="shrink-0 flex items-center leading-none text-accent-primary">{cat.icon}</span>}
                    <span className="font-bold text-sm text-content-primary truncate">{cat.title}</span>
                  </div>
                  {cat.badge && <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-status-warning font-semibold shrink-0">{cat.badge}</span>}
                </div>

                <div className="space-y-3 text-xs">
                  {cat.lists.map((list) => {
                    const visibleItems = isExpanded ? list.items : list.items.slice(0, previewLimit);
                    const totalFormatted = typeof list.total === 'number' ? fmt.number(list.total) : list.total;
                    const listColor = list.color || 'var(--color-accent-primary)';

                    return (
                      <div key={list.label}>
                        <div className="flex justify-between font-semibold mb-1" style={{ color: listColor }}>
                          <span>
                            {list.label}
                            {totalFormatted !== undefined ? `: ${totalFormatted}` : ''}
                          </span>
                          <span className="text-[11px] font-normal text-content-dim">
                            {list.items.length} {t.common.models}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-content-muted pl-1.5 border-l-2 border-border-subtle">
                          {visibleItems.map((item) => (
                            <div key={item.name} className="flex justify-between">
                              <span className="truncate pr-2">{item.name}</span>
                              <span className="font-mono text-content-secondary">{typeof item.value === 'number' ? fmt.number(item.value) : item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasMore && (
                <button type="button" onClick={() => toggleCategory(cat.id)} className="btn-subtle mt-3 w-full justify-center group">
                  <span>{isExpanded ? t.common.collapse : `${t.common.expandAll} (${fmt.number(maxItems)})`}</span>
                  <ChevronDownIcon className={cn('w-3.5 h-3.5 transform transition-transform duration-200 text-content-dim group-hover:text-accent-hover', isExpanded && 'rotate-180')} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
