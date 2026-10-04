import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

/** Configuration options for the useScrollSpy hook. */
export interface UseScrollSpyOptions {
  /** CSS selector for tracked section elements. @default '[data-anchor-section]' */
  selector?: string;
  /** Vertical offset in pixels from viewport top (e.g. height of sticky headers). @default 95 */
  offset?: number;
  /** Whether to sync active anchor with window.location.hash upon scrollend. @default true */
  syncHash?: boolean;
}

const getId = (el: HTMLElement) => el.getAttribute('data-anchor-section') || el.id;

/**
 * Universal React hook tracking in-page scroll position to identify the active section anchor
 * based on maximum visible element area in the viewport, supporting deep-linking jumps on mount
 * and smooth scrollend URL hash synchronization.
 */
export function useScrollSpy({ selector = '[data-anchor-section]', offset = 95, syncHash = true }: UseScrollSpyOptions = {}): string {
  const location = useLocation();
  // Initialize with empty string to avoid SSR/SSG hydration mismatch with pre-rendered active class
  const [activeId, setActiveId] = useState<string>('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on location.pathname change to bind new page sections
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!sections.length) return;

    /** Resolves which section anchor currently occupies the largest visible area in the viewport. */
    const findActiveId = (): string => {
      if (window.scrollY < 80) return getId(sections[0]);
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        return getId(sections[sections.length - 1]);
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

      return getId(best);
    };

    const initialHash = window.location.hash ? window.location.hash.slice(1) : '';
    let currentActive = initialHash;

    const target = initialHash ? document.querySelector<HTMLElement>(`[data-anchor-section="${initialHash}"], #${CSS.escape(initialHash)}`) : null;

    if (target) {
      target.scrollIntoView({ behavior: 'instant' });
      setActiveId(initialHash);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      currentActive = findActiveId();
      setActiveId(currentActive);
    }

    // Re-verify after layout and reflow have stabilized
    requestAnimationFrame(() => {
      const el = target ?? (initialHash ? document.querySelector<HTMLElement>(`[data-anchor-section="${initialHash}"], #${CSS.escape(initialHash)}`) : null);
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
      if (!syncHash) return;
      const targetHash = window.scrollY < 80 ? '' : `#${currentActive}`;
      if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash || window.location.pathname + window.location.search);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (syncHash) window.addEventListener('scrollend', onScrollEnd, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (syncHash) window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [location.pathname, selector, offset, syncHash]);

  return activeId;
}
