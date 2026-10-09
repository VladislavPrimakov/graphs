import { useEffect, useRef, useState } from 'react';
import { getHeaderHeight } from './useScrollSpy';

/** Global shared state indicating active programmatic smooth scrolling across all dashboard sections. */
let isScrollActive = false;
let activeTargetId: string | null = null;
let scrollEndCleanup: (() => void) | null = null;

/**
 * Activates scroll lock during programmatic anchor smooth scrolling.
 * While active, intermediate sections suppress rendering until scroll animation settles and triggers 'scroll-settled'.
 */
export function startScrollLock(targetId?: string): void {
  isScrollActive = true;
  activeTargetId = targetId ?? null;

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
    activeTargetId = null;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scroll-settled'));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('scrollend', onScrollEnd, { passive: true, once: true });
    window.addEventListener('wheel', onScrollEnd, { passive: true, once: true });
    window.addEventListener('touchmove', onScrollEnd, { passive: true, once: true });

    scrollEndCleanup = () => {
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('wheel', onScrollEnd);
      window.removeEventListener('touchmove', onScrollEnd);
    };
  }
}

/** Configuration options for the useInView viewport observation hook. */
export interface UseInViewOptions {
  /** Section ID matching anchor navigation targets. */
  id?: string;
  /** Initial visibility state on mount. Set to true for deep-linked target elements or above-the-fold content. @default false */
  initialInView?: boolean;
}

/** Return contract for the useInView hook. */
export interface UseInViewResult<T extends HTMLElement = HTMLDivElement> {
  /** Reference to attach to the target DOM element container. */
  ref: React.RefObject<T | null>;
  /** True once the element has entered the viewport boundary. Stays true permanently. */
  hasEnteredView: boolean;
}

/**
 * Universal React hook tracking viewport proximity via native IntersectionObserver with programmatic scroll suppression.
 * Dynamically factors in sticky header height to prevent elements beneath header from falsely triggering entrance.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options: UseInViewOptions = {}): UseInViewResult<T> {
  const { id, initialInView = false } = options;
  const ref = useRef<T | null>(null);
  const [hasEnteredView, setHasEnteredView] = useState(initialInView);
  const hasEnteredViewRef = useRef(initialInView);

  useEffect(() => {
    if (initialInView || hasEnteredViewRef.current) {
      setHasEnteredView(true);
      hasEnteredViewRef.current = true;
      return;
    }

    const el = ref.current;
    if (!el) return;

    let observer: IntersectionObserver | null = null;

    const enterView = () => {
      hasEnteredViewRef.current = true;
      setHasEnteredView(true);
      observer?.disconnect();
    };

    const headerHeight = getHeaderHeight();
    const effectiveRootMargin = `-${headerHeight}px 0px 400px 0px`;

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        // If programmatic scroll is active, suppress intermediate sections unless this is the explicit target
        if (isScrollActive && id !== activeTargetId) {
          return;
        }
        enterView();
      },
      { rootMargin: effectiveRootMargin },
    );

    observer.observe(el);

    // Re-check visibility when scroll finishes ('scroll-settled')
    const onScrollSettled = () => {
      if (hasEnteredViewRef.current) return;
      const targetEl = ref.current;
      if (!targetEl) return;
      const rect = targetEl.getBoundingClientRect();
      const currentHeaderHeight = getHeaderHeight();
      if (rect.bottom > currentHeaderHeight && rect.top < window.innerHeight + 400) {
        enterView();
      }
    };

    window.addEventListener('scroll-settled', onScrollSettled, { passive: true });

    return () => {
      window.removeEventListener('scroll-settled', onScrollSettled);
      observer?.disconnect();
    };
  }, [id, initialInView]);

  return { ref, hasEnteredView };
}
