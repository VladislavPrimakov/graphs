import type React from 'react';
import { useState } from 'react';
import type { Project, ProjectSource } from '@/types';
import { getTagClasses } from '../styles/tokens';

export type { ProjectSource };

/** Dashboard card item displayed within the interactive catalog grid. */
export type ProjectCardItem = Project & {
  /** Fully qualified hyperlink URL. */
  href: string;
};

/** Props for the interactive catalog grid and tag filter bar. */
export interface CatalogGridProps {
  /** List of all project dashboard cards. */
  projects: ProjectCardItem[];
  /** Complete list of unique tags available for filtering. */
  allUniqueTags: string[];
}

/** Interactive project catalog grid with live multi-tag filtering and metadata cards. */
export const CatalogGrid: React.FC<CatalogGridProps> = ({ projects, allUniqueTags }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const isAllActive = selectedTags.length === 0;

  const toggleTag = (tag: string) => {
    if (tag === 'all') {
      setSelectedTags([]);
    } else {
      setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    }
  };

  const filteredProjects = projects.filter((proj) => {
    if (isAllActive) return true;
    return proj.tags.some((t) => selectedTags.includes(t));
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary tracking-tight">Projects</h2>
      </div>

      {/* Tag Filter Selector */}
      <div className="mb-8 p-3 rounded-2xl bg-surface-card/40 border border-border-subtle/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-content-muted mr-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter by tag:
          </span>

          <button
            type="button"
            onClick={() => toggleTag('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
              isAllActive
                ? 'bg-accent-glow text-accent-primary border-accent-primary/40 shadow-sm shadow-accent-glow'
                : 'bg-surface-card/80 text-content-muted border-border-subtle hover:text-content-primary hover:border-border-muted'
            }`}
          >
            All ({projects.length})
          </button>

          {allUniqueTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full text-xs font-medium border transition-all duration-150 ${
                  isSelected
                    ? 'px-3 py-1 font-semibold bg-accent-glow text-accent-hover border-accent-primary/60 shadow-md shadow-accent-glow scale-105'
                    : 'px-2.5 py-1 bg-surface-card/80 text-content-muted border-border-subtle hover:text-content-primary hover:border-border-muted'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => (
            <div
              key={proj.id}
              className="group relative bg-surface-card/60 border border-border-subtle/80 hover:border-border-muted rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between shadow-lg"
            >
              <div>
                {/* Top Tags list and Last Updated */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {proj.tags.map((tag) => {
                      const style = getTagClasses(tag);
                      const isTagSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleTag(tag);
                          }}
                          title={`Filter by ${tag}`}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all duration-150 hover:scale-105 cursor-pointer ${style} ${
                            isTagSelected ? 'ring-2 ring-accent-primary ring-offset-1 ring-offset-surface-base' : ''
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  {proj.lastUpdated && (
                    <span className="text-[11px] font-medium text-content-dim shrink-0 flex items-center gap-1">
                      <svg className="w-3 h-3 text-content-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {proj.lastUpdated}
                    </span>
                  )}
                </div>

                {/* Title */}
                <a href={proj.href} className="block">
                  <h3 className="text-xl font-bold text-content-primary group-hover:text-accent-hover transition-colors">{proj.title}</h3>
                </a>

                {/* Description */}
                <p className="mt-2.5 text-sm text-content-muted leading-relaxed">{proj.description}</p>
              </div>

              {/* Footer: Sources & Link */}
              <div className="mt-6 pt-4 border-t border-border-subtle/80 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 text-content-muted">
                  <span className="font-semibold text-content-dim">Sources:</span>
                  {proj.sources.map((s, idx) => (
                    <span key={s.url || s.name}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-content-muted hover:text-accent-hover underline underline-offset-2 transition-colors">
                        {s.name}
                      </a>
                      {idx < proj.sources.length - 1 && <span className="text-content-dim ml-1">•</span>}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <a
                    href={proj.href}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-glow text-accent-primary border border-accent-primary/20 hover:bg-accent-glow/80 transition-colors"
                  >
                    Open Dashboard
                    <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* No match fallback */
        <div className="text-center py-12 bg-surface-card/40 border border-border-subtle/80 rounded-2xl">
          <p className="text-content-muted text-sm">No projects found matching the selected tag.</p>
          <button
            type="button"
            onClick={() => setSelectedTags([])}
            className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-glow text-accent-primary border border-accent-primary/30 hover:bg-accent-glow/80 transition-colors"
          >
            Reset Filter
          </button>
        </div>
      )}
    </div>
  );
};

export default CatalogGrid;
