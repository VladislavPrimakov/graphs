import type React from 'react';
import { ClockIcon } from '@/components/icons';
import { TagBadge } from '@/components/ui/TagBadge';
import type { ProjectTag } from '@/types';
import { useFormat, useTranslation } from '@/utils/provider';

/** Props for the PageHeader component. */
export interface PageHeaderProps {
  /** Primary dashboard heading title. */
  title: string;
  /** Detailed subtitle or scope description. */
  description?: string;
  /** Array of categorization tags. */
  tags?: ProjectTag[];
  /** Timestamp or ISO date string of latest data update. */
  lastUpdated?: string;
}

/** Hero header component rendering title, description, metadata tags, and update timestamps. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, tags = [], lastUpdated }) => {
  const { t } = useTranslation();
  const fmt = useFormat();

  return (
    <header className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-content-primary tracking-tight">{title}</h1>
        {lastUpdated && (
          <div className="control-panel inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-muted shrink-0">
            <ClockIcon className="w-3.5 h-3.5 text-accent-primary shrink-0" />
            <span>
              {t.common.updated}: <span className="text-content-primary font-semibold">{fmt.date(lastUpdated)}</span>
            </span>
          </div>
        )}
      </div>
      {description && <p className="mt-3 text-base text-content-muted leading-relaxed">{description}</p>}

      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-content-dim font-semibold uppercase tracking-wider py-1">{t.common.tags}:</span>
          {tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </header>
  );
};
