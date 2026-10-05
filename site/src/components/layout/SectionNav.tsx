import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/utils/locales';
import { useScrollSpy } from '@/utils/useScrollSpy';

/** Props for the SectionNav outline component. */
export interface SectionNavProps {
  /** Array of canonical section IDs (e.g. ['payload-capacity', 'launch-costs']). */
  sections: string[];
  /** Project slug for URL construction. */
  projectSlug: string;
  /** Mapping of section ID to localized section title. */
  sectionTitles?: Record<string, string>;
  /** Base project title for document.title update on click. */
  projectTitle?: string;
  /** Initial section identifier from route params. */
  initialSection?: string;
}

/** Horizontal outline navigation pill bar rendered into header center slot via React Portal. */
export const SectionNav: React.FC<SectionNavProps> = ({ sections, projectSlug, sectionTitles, projectTitle, initialSection }) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const { getHref } = useLanguage();

  const activeId = useScrollSpy({
    selector: '[data-section]',
    projectSlug,
    projectTitle,
    sectionTitles,
    initialSection,
  });

  useEffect(() => {
    setPortalTarget(document.getElementById('header-section-nav'));
  }, []);

  // Auto-center active pill within horizontal scroll container
  useEffect(() => {
    if (!containerRef.current || !activeId) return;
    const activePill = containerRef.current.querySelector<HTMLElement>(`[data-nav-section="${activeId}"]`);
    if (activePill) {
      const container = containerRef.current;
      const targetScrollLeft = activePill.offsetLeft - container.offsetWidth / 2 + activePill.offsetWidth / 2;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [activeId]);

  if (!portalTarget || sections.length <= 1) return null;

  return createPortal(
    <nav
      aria-label="Section navigation"
      ref={containerRef}
      className="flex items-center justify-center-safe gap-1.5 overflow-x-auto scrollbar-none py-1 max-w-full px-2 mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
    >
      {sections.map((sectionId) => {
        const isActive = activeId === sectionId;
        const targetHref = getHref(`/${projectSlug}/${sectionId}`);

        return (
          <a
            key={sectionId}
            href={targetHref}
            data-nav-section={sectionId}
            onClick={(e) => {
              const target = document.querySelector<HTMLElement>(`[data-section="${sectionId}"], #${CSS.escape(sectionId)}`);
              if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
                history.replaceState(null, '', targetHref + window.location.search);
                if (projectTitle && sectionTitles?.[sectionId]) {
                  document.title = `${projectTitle} — ${sectionTitles[sectionId]}`;
                }
              }
            }}
            className={cn('nav-pill shrink-0 whitespace-nowrap', isActive ? 'nav-pill-active' : 'nav-pill-idle')}
          >
            /{sectionId}
          </a>
        );
      })}
    </nav>,
    portalTarget,
  );
};
