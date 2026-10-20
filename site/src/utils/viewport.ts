import type React from 'react';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Canonical HTML data attribute name marking scroll-spy tracked section elements. */
export const SECTION_DATA_ATTR = 'data-section';

/** Canonical DOM selector for tracked dashboard and changelog sections. */
export const SECTION_SELECTOR = `[${SECTION_DATA_ATTR}]`;

/** Canonical HTML data attribute name marking sticky filter toolbar elements. */
export const STICKY_TOOLBAR_DATA_ATTR = 'data-sticky-toolbar';

/** Canonical DOM selector for sticky filter toolbars. */
export const STICKY_TOOLBAR_SELECTOR = `[${STICKY_TOOLBAR_DATA_ATTR}]`;

/** Custom DOM event name dispatched when programmatic smooth scrolling settles. */
export const SCROLL_SETTLED_EVENT = 'scroll-settled';

/** Bottom viewport lookahead buffer margin in pixels for lazy loading and reading boundary detection. @default 400 */
export const VIEWPORT_BOTTOM_MARGIN = 400;

/** Scroll position threshold in pixels below which the viewport is considered at the top of the page. @default 10 */
export const SCROLL_TOP_THRESHOLD = 10;

/** Scroll tolerance threshold in pixels for detecting when viewport reaches the bottom of the page. @default 30 */
export const SCROLL_BOTTOM_THRESHOLD = 30;

const getSectionId = (el: HTMLElement) => el.getAttribute(SECTION_DATA_ATTR) || el.id;

let cachedHeader: HTMLElement | null = null;

/**
 * Returns dynamic sticky header and toolbar height offset in pixels.
 * If target element is provided, checks if it belongs to a section group with a sticky filter toolbar.
 * @default 64
 */
export function getHeaderHeight(target?: HTMLElement | null): number {
  if (typeof document === 'undefined') return 64;

  if (!cachedHeader?.isConnected) {
    cachedHeader = document.querySelector<HTMLElement>('header');
  }
  const base = cachedHeader?.isConnected ? cachedHeader.offsetHeight : 64;
  const toolbar = target?.closest('.section-group')?.querySelector<HTMLElement>(STICKY_TOOLBAR_SELECTOR)?.offsetHeight ?? 0;

  return base + toolbar;
}

/**
 * Smoothly or instantly scrolls the viewport to the target section element,
 * dynamically applying the exact scroll margin for the site header and active filter toolbar.
 */
export function scrollToSection(target: HTMLElement | string, behavior: ScrollBehavior = 'smooth'): void {
  if (typeof document === 'undefined' || !target) return;

  const targetEl = typeof target === 'string' ? document.getElementById(target) || document.querySelector<HTMLElement>(`[${SECTION_DATA_ATTR}="${CSS.escape(target)}"]`) : target;

  if (!targetEl) return;

  const margin = `${getHeaderHeight(targetEl)}px`;
  if (targetEl.style.scrollMarginTop !== margin) {
    targetEl.style.scrollMarginTop = margin;
  }

  if (behavior === 'smooth') {
    const sectionId = typeof target === 'string' ? target : getSectionId(targetEl);
    if (sectionId) {
      startScrollLock(sectionId);
    }
  }

  targetEl.scrollIntoView({ behavior });
}

/** Global shared state indicating active programmatic smooth scrolling across all dashboard sections. */
let isScrollActive = false;
let activeTargetId = '';
let scrollEndCleanup: (() => void) | null = null;

/**
 * Activates scroll lock during programmatic anchor smooth scrolling.
 * While active, intermediate sections suppress rendering until scroll animation settles and triggers 'scroll-settled'.
 */
export function startScrollLock(targetId: string): void {
  isScrollActive = true;
  activeTargetId = targetId;

  if (scrollEndCleanup) {
    scrollEndCleanup();
    scrollEndCleanup = null;
  }

  const onScrollEnd = () => {
    if (scrollEndCleanup) {
      scrollEndCleanup();
      scrollEndCleanup = null;
    }
    isScrollActive = false;
    activeTargetId = '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCROLL_SETTLED_EVENT));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('scrollend', onScrollEnd, {
      passive: true,
      once: true,
    });
    window.addEventListener('wheel', onScrollEnd, {
      passive: true,
      once: true,
    });
    window.addEventListener('touchmove', onScrollEnd, {
      passive: true,
      once: true,
    });

    scrollEndCleanup = () => {
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('wheel', onScrollEnd);
      window.removeEventListener('touchmove', onScrollEnd);
    };
  }
}

/** Return contract for the useInView hook. */
export interface UseInViewResult<T extends HTMLElement = HTMLDivElement> {
  /** Reference to attach to the target DOM element container. */
  ref: React.RefObject<T | null>;
  /** True once the element has entered the viewport boundary. Stays true permanently for lazy loading. */
  hasEnteredView: boolean;
}

/**
 * Universal React hook tracking viewport proximity via native IntersectionObserver with programmatic scroll suppression.
 * Automatically disconnects and cleans up all listeners once the element enters the viewport boundary.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(id: string, initialInView = false): UseInViewResult<T> {
  const ref = useRef<T | null>(null);
  const [hasEnteredView, setHasEnteredView] = useState(initialInView);
  const hasEnteredViewRef = useRef(initialInView);

  useEffect(() => {
    // Short-circuit if element has already entered view and permanently triggered lazy loading
    if (hasEnteredViewRef.current) return;

    const el = ref.current;
    if (!el) return;

    // Clip top by header height to avoid triggers under sticky navbar; extend bottom by lookahead buffer
    const headerHeight = getHeaderHeight(el);
    const effectiveRootMargin = `-${headerHeight}px 0px ${VIEWPORT_BOTTOM_MARGIN}px 0px`;

    let observer: IntersectionObserver | null = null;

    const cleanup = () => {
      window.removeEventListener(SCROLL_SETTLED_EVENT, onScrollSettled);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    // Permanently mark visible, notify React state, and immediately tear down observer and listeners
    const markEntered = () => {
      if (!hasEnteredViewRef.current) {
        hasEnteredViewRef.current = true;
        setHasEnteredView(true);
        cleanup();
      }
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        // Suppress intermediate sections during programmatic smooth scroll to prevent canvas lag and data fetching
        if (isScrollActive && id !== activeTargetId) {
          return;
        }

        markEntered();
      },
      { rootMargin: effectiveRootMargin },
    );

    observer.observe(el);

    // Re-check visibility when programmatic scroll settles, catching sections that arrived in the reading zone
    const onScrollSettled = () => {
      const targetEl = ref.current;
      if (!targetEl || hasEnteredViewRef.current) return;
      const rect = targetEl.getBoundingClientRect();
      const currentHeaderHeight = getHeaderHeight(targetEl);
      const isVisible = rect.bottom > currentHeaderHeight && rect.top < window.innerHeight + VIEWPORT_BOTTOM_MARGIN;

      if (isVisible) {
        markEntered();
      }
    };

    window.addEventListener(SCROLL_SETTLED_EVENT, onScrollSettled, {
      passive: true,
    });

    return cleanup;
  }, [id]);

  return { ref, hasEnteredView };
}

/**
 * Universal React hook tracking in-page scroll position to identify the active section or anchor,
 * auto-scrolling to deep-linked targets on mount, and synchronizing the URL path and document title
 * upon scrollend via history.replaceState.
 */
export function useScrollSpy(getHref: (activeId: string) => string, initialId?: string, resolveTitle?: (activeId: string) => string | undefined): string {
  const [activeId, setActiveId] = useState<string>(initialId || '');

  // Non-reactive callback synchronizing browser URL path and title without triggering effect re-subscriptions
  const onScrollSettle = useEffectEvent((activeSection: string) => {
    const targetHref = getHref(activeSection);
    if (window.location.pathname !== targetHref) {
      history.replaceState(null, '', targetHref + window.location.search);
    }

    if (resolveTitle) {
      const targetTitle = resolveTitle(activeSection);
      if (targetTitle && document.title !== targetTitle) {
        document.title = targetTitle;
      }
    }
  });

  // Instantly reposition viewport to deep-linked target on mount before paint to prevent layout shift
  useIsomorphicLayoutEffect(() => {
    if (initialId) {
      scrollToSection(initialId, 'instant');
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [initialId]);

  // Continuous scroll telemetry updating active section and synchronizing URL path/title upon scrollend
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    if (!sections.length) return;

    /** Resolves which section currently occupies the largest visible area in the viewport. */
    const findActiveId = (): string => {
      // Clear active section when scrolled back to the top header zone
      if (window.scrollY <= SCROLL_TOP_THRESHOLD) {
        return '';
      }

      // Force-select bottommost section when scrolled to end of page to guarantee activation of short sections
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - SCROLL_BOTTOM_THRESHOLD) {
        return getSectionId(sections[sections.length - 1]);
      }

      let best: HTMLElement | null = null;
      let maxVisible = -1;

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const topOffset = getHeaderHeight(sec);
        const bottomLimit = Math.max(topOffset + 1, window.innerHeight - VIEWPORT_BOTTOM_MARGIN);
        const rect = sec.getBoundingClientRect();
        const isHeading = sec.tagName.length === 2 && sec.tagName[0] === 'H';
        // Heading sections (e.g. changelog) span to next heading or document bottom; standard sections use element bounds
        const bottom = isHeading ? (sections[i + 1]?.getBoundingClientRect().top ?? document.documentElement.getBoundingClientRect().bottom) : rect.bottom;

        const visible = Math.max(0, Math.min(bottom, bottomLimit) - Math.max(rect.top, topOffset));
        if (visible > maxVisible) {
          maxVisible = visible;
          best = sec;
        }
      }

      return best ? getSectionId(best) : '';
    };

    let ticking = false;
    let rafId = 0;

    // Throttle continuous scroll tracking to display refresh rate via requestAnimationFrame
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(() => {
          const active = findActiveId();
          setActiveId((prev) => (prev !== active ? active : prev));
          ticking = false;
        });
      }
    };

    let lastSettled = initialId || '';

    // On scroll completion, commit active section state and synchronize URL/title via history.replaceState
    const onScrollEnd = () => {
      const activeSection = findActiveId();
      if (activeSection === lastSettled) return;
      lastSettled = activeSection;

      setActiveId(activeSection);
      onScrollSettle(activeSection);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd, { passive: true });

    return () => {
      if (ticking) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [initialId]);

  return activeId;
}
