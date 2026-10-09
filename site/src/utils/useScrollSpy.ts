import { useEffect, useEffectEvent, useLayoutEffect, useState } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Canonical HTML data attribute name marking scroll-spy tracked section elements. */
export const SECTION_DATA_ATTR = 'data-section';

/** Canonical DOM selector for tracked dashboard and changelog sections. */
export const SECTION_SELECTOR = `[${SECTION_DATA_ATTR}]`;

let cachedHeader: HTMLElement | null = null;

/** Returns dynamic sticky header height offset in pixels. @default 80 */
export function getHeaderHeight(): number {
  if (typeof document === 'undefined') return 80;
  if (!cachedHeader?.isConnected) {
    cachedHeader = document.querySelector<HTMLElement>('header');
  }
  return cachedHeader ? cachedHeader.offsetHeight : 80;
}

/** Configuration options for the useScrollSpy hook. */
export interface UseScrollSpyOptions {
  /** Function to resolve canonical URL href for the active section. */
  getHref: (activeId: string) => string;
  /** Initial element identifier from route params. */
  initialId?: string;
  /** Optional function to resolve document.title for the active section. */
  resolveTitle?: (activeId: string) => string | undefined;
}

const getSectionId = (el: HTMLElement) => el.getAttribute(SECTION_DATA_ATTR) || el.id;

/**
 * Universal React hook tracking in-page scroll position to identify the active section or anchor,
 * auto-scrolling to deep-linked targets on mount, and synchronizing the URL path and document title
 * upon scrollend via history.replaceState.
 */
export function useScrollSpy({ getHref, initialId, resolveTitle }: UseScrollSpyOptions): string {
  // Initialize with initialId to prevent hydration layout shift
  const [activeId, setActiveId] = useState<string>(initialId || '');

  // Non-reactive event handler for scroll settlement via React 19 useEffectEvent
  const onScrollSettle = useEffectEvent((activeSection: string) => {
    const targetHref = getHref(activeSection);
    if (window.location.pathname !== targetHref || window.location.hash) {
      history.replaceState(null, '', targetHref + window.location.search);
    }

    if (resolveTitle) {
      const targetTitle = resolveTitle(activeSection);
      if (targetTitle && document.title !== targetTitle) {
        document.title = targetTitle;
      }
    }
  });

  // 1. Initial navigation scroll to deep-linked target element or page top on mount / initialId change
  useIsomorphicLayoutEffect(() => {
    if (initialId) {
      const target = document.getElementById(initialId) || document.querySelector<HTMLElement>(`[${SECTION_DATA_ATTR}="${CSS.escape(initialId)}"]`);
      target?.scrollIntoView({ behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [initialId]);

  // 2. Continuous scroll telemetry updating active section and synchronizing URL path/title upon scrollend
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    if (!sections.length) return;

    /** Resolves which section currently occupies the largest visible area in the viewport. */
    const findActiveId = (): string => {
      const topOffset = getHeaderHeight();

      // If scrolled to the top of the page, clear active section
      if (window.scrollY <= 10) {
        return '';
      }

      // If scrolled to the bottom of the page, activate the last section
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 30) {
        return getSectionId(sections[sections.length - 1]);
      }

      // Clip evaluation boundary: ignore bottom 400px of viewport to prevent upcoming sections from stealing active focus
      const bottomLimit = Math.max(topOffset + 1, window.innerHeight - 400);

      const rects = sections.map((sec) => sec.getBoundingClientRect());
      const docBottom = document.documentElement.getBoundingClientRect().bottom;

      let best: HTMLElement | null = null;
      let maxVisible = -1;

      // Find section with the largest visible vertical height within active reading area [topOffset, bottomLimit]
      for (let i = 0; i < sections.length; i++) {
        const rect = rects[i];
        const isHeading = sections[i].tagName.length === 2 && sections[i].tagName[0] === 'H';
        const bottom = isHeading ? (rects[i + 1]?.top ?? docBottom) : rect.bottom;

        // Visible vertical height clipped by active reading bounds [topOffset, bottomLimit]
        const visible = Math.max(0, Math.min(bottom, bottomLimit) - Math.max(rect.top, topOffset));
        if (visible > maxVisible) {
          maxVisible = visible;
          best = sections[i];
        }
      }

      return best ? getSectionId(best) : '';
    };

    // Throttled scroll listener updating active section highlight during scrolling
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const active = findActiveId();
          setActiveId((prev) => (prev !== active ? active : prev));
          ticking = false;
        });
      }
    };

    let lastSettled = initialId || '';

    // Synchronize URL path and document title once scrolling settles (native scrollend)
    const onScrollEnd = () => {
      const activeSection = findActiveId();
      if (activeSection === lastSettled) return;
      lastSettled = activeSection;

      setActiveId(activeSection);
      onScrollSettle(activeSection);
    };

    // Attach passive scroll and scrollend listeners
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [initialId]);

  return activeId;
}
