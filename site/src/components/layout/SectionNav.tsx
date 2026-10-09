import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { usePath } from '@/utils/provider';
import { startScrollLock } from '@/utils/useInView';
import { SECTION_DATA_ATTR, useScrollSpy } from '@/utils/useScrollSpy';

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
  const { getHref } = usePath();

  const activeId = useScrollSpy({
    initialId: initialSection,
    getHref: (id) => (id ? getHref(`/${projectSlug}/${id}`) : getHref(`/${projectSlug}`)),
    resolveTitle: (id) => {
      if (!id || !projectTitle || !sectionTitles?.[id]) return projectTitle;
      return `${projectTitle} — ${sectionTitles[id]}`;
    },
  });

  useEffect(() => {
    setPortalTarget(document.getElementById('header-section-nav'));
  }, []);

  // Auto-center active pill within horizontal scroll container on activeId change and resize
  useEffect(() => {
    if (!containerRef.current || !activeId) return;

    const centerPill = (behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container) return;
      const activePill = container.querySelector<HTMLElement>(`[data-nav-section="${activeId}"]`);
      if (activePill) {
        const targetScrollLeft = activePill.offsetLeft - container.offsetWidth / 2 + activePill.offsetWidth / 2;
        container.scrollTo({ left: targetScrollLeft, behavior });
      }
    };

    centerPill('smooth');

    const handleResize = () => centerPill('instant');
    window.addEventListener('resize', handleResize, { passive: true });

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
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
              const target = document.querySelector<HTMLElement>(`[${SECTION_DATA_ATTR}="${sectionId}"], #${CSS.escape(sectionId)}`);
              if (target) {
                e.preventDefault();
                startScrollLock(sectionId);
                target.scrollIntoView({ behavior: 'smooth' });
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
