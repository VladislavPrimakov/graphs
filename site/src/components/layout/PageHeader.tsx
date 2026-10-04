import type React from 'react';
import { ClockIcon, ExternalLinkIcon } from '@/components/icons';
import { TagBadge } from '@/components/ui/TagBadge';
import type { ProjectSource, ProjectTag } from '@/types';
import { useFormat, useTranslation } from '@/utils/locales';

/** Props for the PageHeader component. */
export interface PageHeaderProps {
  /** Primary dashboard heading title. */
  title: string;
  /** Detailed subtitle or scope description. */
  description?: string;
  /** Array of categorization tags. */
  tags?: ProjectTag[];
  /** Primary statistical source references and links. */
  sources?: ProjectSource[];
  /** Timestamp or ISO date string of latest data update. */
  lastUpdated?: string;
}

/** Hero header component rendering title, description, metadata tags, source links, and update timestamps. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, tags = [], sources = [], lastUpdated }) => {
  const { t } = useTranslation();
  const fmt = useFormat();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-content-primary tracking-tight">{title}</h1>
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

      {(tags.length > 0 || sources.length > 0) && (
        <div className="mt-5 grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2.5 text-xs">
          {tags.length > 0 && (
            <>
              <span className="text-content-dim font-semibold uppercase tracking-wider self-start sm:self-center py-1">{t.common.tags}:</span>
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            </>
          )}

          {sources.length > 0 && (
            <>
              <span className="text-content-dim font-semibold uppercase tracking-wider self-start sm:self-center py-1">{t.common.sources}:</span>
              <div className="flex flex-wrap items-center gap-2">
                {sources.map((s) => (
                  <a key={s.url || s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="btn-subtle px-2.5 py-1 text-accent-primary">
                    <span>{s.name}</span>
                    <ExternalLinkIcon className="w-3 h-3 text-content-dim" />
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
