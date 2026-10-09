import metadata from '@data/metadata.json';
import { startTransition, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon, ClockIcon, FilterIcon } from '@/components/icons';
import { FilterPills } from '@/components/ui/FilterPills';
import { TagBadge } from '@/components/ui/TagBadge';
import { ALL_UNIQUE_TAGS } from '@/projects/registry';
import type { ProjectTag } from '@/types';
import { cn } from '@/utils/cn';
import { useCatalog, useFormat, usePath, useTranslation } from '@/utils/provider';

/** Overview catalog homepage presenting hero banner and tag-filterable project cards. */
export default function CatalogPage() {
  const projects = useCatalog();
  const { getPath } = usePath();
  const [selectedTags, setSelectedTags] = useState<ProjectTag[]>([]);
  const { t, getTagLabel } = useTranslation();
  const fmt = useFormat();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const isAllActive = selectedTags.length === 0;

  const handleToggleTag = (tag: ProjectTag) => {
    startTransition(() => {
      setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    });
  };

  const filteredProjects = projects.filter((proj) => {
    if (isAllActive) return true;
    return proj.tags.some((t) => selectedTags.includes(t));
  });

  return (
    <>
      <title>{t.common.catalog}</title>
      <meta name="description" content={t.common.heroSubtitle} />
      <meta property="og:site_name" content={t.common.graphs} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={t.common.catalog} />
      <meta property="og:description" content={t.common.heroSubtitle} />
      <div className="flex flex-col gap-8">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-b from-surface-card via-surface-card/80 to-surface-base border border-border-subtle p-8 shadow-xl">
          <div className="w-full">
            <div className="tag-pill bg-accent-glow text-accent-primary border-accent-primary/20 mb-3 space-x-2">
              <span>{t.common.dataVisualizations}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-content-primary tracking-tight">{t.common.heroTitle}</h1>
            <p className="mt-3 text-sm text-content-secondary leading-relaxed">{t.common.heroSubtitle}</p>
          </div>
        </div>

        {/* Projects Grid Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-content-primary tracking-tight">{t.common.projects}</h2>
          </div>

          {/* Tag Filter Selector */}
          <div className="control-panel mb-8 p-3 rounded-2xl bg-surface-card/40 border-border-subtle/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-content-muted mr-1 flex items-center gap-1.5">
                <FilterIcon className="w-3.5 h-3.5 text-accent-primary" />
                {t.common.filterByTag}:
              </span>

              <FilterPills
                items={ALL_UNIQUE_TAGS.map((tag) => ({
                  id: tag,
                  label: getTagLabel(tag),
                }))}
                selected={selectedTags}
                onChange={setSelectedTags}
                allLabel={t.common.all}
                allCount={projects.length}
              />
            </div>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((proj) => {
                const projectPath = getPath(`/${proj.id}`);
                const lastUpdated = (metadata as Record<string, string>)[proj.id];

                return (
                  <div key={proj.id} className="group relative card-elevated p-6 flex flex-col justify-between">
                    <div>
                      {/* Top Tags list and Last Updated */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {proj.tags.map((tag) => {
                            const isTagSelected = selectedTags.includes(tag);
                            return (
                              <TagBadge
                                key={tag}
                                tag={tag}
                                interactive
                                onClick={() => handleToggleTag(tag)}
                                className={cn(isTagSelected && 'ring-2 ring-accent-primary ring-offset-1 ring-offset-surface-base')}
                              />
                            );
                          })}
                        </div>
                        {lastUpdated && (
                          <span className="text-[11px] font-medium text-content-dim shrink-0 flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5 text-content-dim" />
                            {fmt.date(lastUpdated)}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link to={projectPath} className="block">
                        <h3 className="text-xl font-bold text-content-primary group-hover:text-accent-hover transition-colors">{proj.title}</h3>
                      </Link>

                      {/* Description */}
                      <p className="mt-2.5 text-sm text-content-muted leading-relaxed">{proj.description}</p>
                    </div>

                    {/* Footer: Sections & Dashboard Link */}
                    <div className="mt-6 pt-4 border-t border-border-subtle/80 space-y-3 text-xs">
                      {proj.sections.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-dim block">
                            {proj.sections.length} {t.common.sections}:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {proj.sections.map((sectionId) => {
                              const sectionTitle = proj.sectionTitles?.[sectionId] ?? sectionId;
                              const sectionPath = getPath(`/${proj.id}/${sectionId}`);
                              return (
                                <Link
                                  key={sectionId}
                                  to={sectionPath}
                                  className="btn-subtle px-2 py-0.5 text-xs text-content-secondary hover:text-accent-primary hover:border-accent-primary/40 transition-colors"
                                >
                                  {sectionTitle}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <Link to={projectPath} className="btn-accent">
                          <span>{t.common.openDashboard}</span>
                          <ArrowRightIcon className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* No match fallback */
            <div className="card text-center py-12 bg-surface-card/40 border-border-subtle/80">
              <p className="text-content-muted text-sm">{t.common.noProjectsFound}</p>
              <button type="button" onClick={() => setSelectedTags([])} className="btn-accent mt-3">
                {t.common.resetFilter}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
