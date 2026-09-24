import type React from 'react';
import { useState } from 'react';
import type { LossCategoryDetailData, LossCategoryItem } from '@/types';
import { ChartCard } from '../ChartCard';

/** Props for the equipment model breakdown accordion grid. */
export interface WarLossesEquipmentBreakdownProps {
  /** List of top-level equipment category metadata. */
  categories: LossCategoryItem[];
  /** Detailed model counts by faction keyed by category identifier. */
  by_category: Record<string, LossCategoryDetailData>;
}

/** Interactive card grid displaying specific verified equipment models lost by each side with individual category expand/collapse controls. */
export const WarLossesEquipmentBreakdown: React.FC<WarLossesEquipmentBreakdownProps> = ({ categories, by_category }) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const expandableCategories = categories.filter((cat) => {
    const catData = by_category[cat.id];
    const rfLen = catData?.models?.rf?.length || 0;
    const uaLen = catData?.models?.ua?.length || 0;
    return rfLen > 5 || uaLen > 5;
  });

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
    <section data-anchor-section="equipment-breakdown" className="scroll-mt-20 sm:scroll-mt-24">
      <ChartCard
        anchorId="equipment-breakdown"
        headerRight={
          expandableCategories.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllCategories}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card/90 hover:bg-surface-elevated border border-border-subtle hover:border-border-muted text-xs font-semibold text-content-secondary hover:text-accent-hover transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>{allExpanded ? 'Collapse all categories' : 'Expand all categories'}</span>
            </button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start pt-10 sm:pt-11">
          {categories.map((cat) => {
            const catData = by_category[cat.id];
            const allRf = catData?.models?.rf || [];
            const allUa = catData?.models?.ua || [];
            const isExpanded = Boolean(expandedCategories[cat.id]);
            const topRf = isExpanded ? allRf : allRf.slice(0, 5);
            const topUa = isExpanded ? allUa : allUa.slice(0, 5);
            const hasMore = allRf.length > 5 || allUa.length > 5;
            const totalModels = Math.max(allRf.length, allUa.length);

            return (
              <div key={cat.id} className="bg-surface-base/70 border border-border-subtle rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-border-muted/80">
                <div>
                  <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2 mb-3">
                    <span className="font-bold text-sm text-content-primary">{cat.label_en}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-status-warning font-semibold">{cat.ratio ? `${cat.ratio}:1` : '—'}</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* RF */}
                    <div>
                      <div className="flex justify-between font-semibold text-status-danger mb-1">
                        <span>RF: {cat.rf.toLocaleString()}</span>
                        <span className="text-[11px] font-normal text-content-dim">{allRf.length} models</span>
                      </div>
                      <div className="space-y-0.5 text-content-muted pl-1 border-l-2 border-status-danger/40">
                        {topRf.map((m) => (
                          <div key={m.name} className="flex justify-between">
                            <span className="truncate pr-2">{m.name}</span>
                            <span className="font-mono text-content-secondary">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* UA */}
                    <div>
                      <div className="flex justify-between font-semibold text-accent-primary mb-1">
                        <span>UA: {cat.ua.toLocaleString()}</span>
                        <span className="text-[11px] font-normal text-content-dim">{allUa.length} models</span>
                      </div>
                      <div className="space-y-0.5 text-content-muted pl-1 border-l-2 border-accent-primary/40">
                        {topUa.map((m) => (
                          <div key={m.name} className="flex justify-between">
                            <span className="truncate pr-2">{m.name}</span>
                            <span className="font-mono text-content-secondary">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {hasMore && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="mt-3 w-full py-1.5 px-3 rounded-lg bg-surface-card/90 hover:bg-surface-elevated border border-border-subtle hover:border-border-muted text-xs font-semibold text-content-muted hover:text-accent-hover transition-colors flex items-center justify-center gap-1.5 group"
                  >
                    <span>{isExpanded ? 'Collapse' : `Expand all (${totalModels})`}</span>
                    <svg
                      className={`w-3.5 h-3.5 transform transition-transform duration-200 text-content-dim group-hover:text-accent-hover ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </ChartCard>
    </section>
  );
};

export default WarLossesEquipmentBreakdown;
