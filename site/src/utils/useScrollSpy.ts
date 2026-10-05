import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useLanguage } from '@/utils/locales';

/** Configuration options for the useScrollSpy hook. */
export interface UseScrollSpyOptions {
  /** CSS selector for tracked section elements. @default '[data-section]' */
  selector?: string;
  /** Vertical offset in pixels from viewport top (e.g. height of sticky headers). @default 95 */
  offset?: number;
  /** Unique project slug for constructing canonical path URLs. */
  projectSlug?: string;
  /** Mapping of section ID to localized section title for dynamic document.title updates. */
  sectionTitles?: Record<string, string>;
  /** Base project title for document.title. */
  projectTitle?: string;
  /** Initial section identifier from route params. */
  initialSection?: string;
}

const getSectionId = (el: HTMLElement) => el.getAttribute('data-section') || el.id;

/**
 * Universal React hook tracking in-page scroll position to identify the active dashboard section,
 * auto-scrolling to deep-linked section paths on mount, and synchronizing the URL path and document title
 * upon scrollend via history.replaceState.
 */
export function useScrollSpy({ selector = '[data-section]', offset = 95, projectSlug, sectionTitles, projectTitle, initialSection }: UseScrollSpyOptions = {}): string {
  const location = useLocation();
  const { getHref } = useLanguage();
  // Initialize with initialSection to prevent hydration layout shift
  const [activeId, setActiveId] = useState<string>(initialSection || '');

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when route pathname changes
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!sections.length) return;

    /** Resolves which section currently occupies the largest visible area in the viewport. */
    const findActiveId = (): string => {
      if (window.scrollY < 80) return getSectionId(sections[0]);
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        return getSectionId(sections[sections.length - 1]);
      }

      let best = sections[0];
      let maxVisible = -1;

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const rect = sec.getBoundingClientRect();
        const bottom = sec.offsetHeight > 60 ? rect.bottom : (sections[i + 1]?.getBoundingClientRect().top ?? document.documentElement.getBoundingClientRect().bottom);

        const visible = Math.max(0, Math.min(bottom, window.innerHeight) - Math.max(rect.top, offset));
        if (visible > maxVisible) {
          maxVisible = visible;
          best = sec;
        }
      }

      return getSectionId(best);
    };

    let currentActive = initialSection || '';
    const target = initialSection ? document.querySelector<HTMLElement>(`[data-section="${initialSection}"], #${CSS.escape(initialSection)}`) : null;

    if (target && initialSection) {
      target.scrollIntoView({ behavior: 'instant' });
      setActiveId(initialSection);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      currentActive = findActiveId();
      setActiveId(currentActive);
    }

    // Re-verify after layout and reflow have stabilized
    requestAnimationFrame(() => {
      const el = target ?? (initialSection ? document.querySelector<HTMLElement>(`[data-section="${initialSection}"], #${CSS.escape(initialSection)}`) : null);
      if (el) {
        el.scrollIntoView({ behavior: 'instant' });
      }
      const settled = findActiveId();
      if (settled) {
        currentActive = settled;
        setActiveId((prev) => (prev !== settled ? settled : prev));
      }
    });

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          currentActive = findActiveId();
          setActiveId((prev) => (prev !== currentActive ? currentActive : prev));
          ticking = false;
        });
      }
    };

    const onScrollEnd = () => {
      if (!projectSlug) return;
      const isTop = window.scrollY < 80;
      const targetHref = isTop ? getHref(`/${projectSlug}`) : getHref(`/${projectSlug}/${currentActive}`);
      const targetTitle = !isTop && projectTitle && sectionTitles?.[currentActive] ? `${projectTitle} — ${sectionTitles[currentActive]}` : projectTitle;

      if (window.location.pathname !== targetHref) {
        history.replaceState(null, '', targetHref + window.location.search);
      }
      if (targetTitle && document.title !== targetTitle) {
        document.title = targetTitle;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [location.pathname, selector, offset, projectSlug, initialSection]);

  return activeId;
}
