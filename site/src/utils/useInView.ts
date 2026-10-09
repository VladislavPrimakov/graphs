import { useEffect, useRef, useState } from 'react';

/** Configuration options for the useInView viewport observation hook. */
export interface UseInViewOptions {
  /** Margin around the root viewport bounding box used to trigger pre-loading before the element scrolls into view. Defaults dynamically to `-${headerHeight}px 0px 400px 0px`. */
  rootMargin?: string;
  /** Initial visibility state on mount. Set to true for deep-linked target elements or above-the-fold content. @default false */
  initialInView?: boolean;
  /** Whether viewport observation is active. When false, ignores intersection events. @default true */
  enabled?: boolean;
  /** Whether to disconnect observer immediately once the element has entered view. @default false */
  once?: boolean;
}

/** Return contract for the useInView hook. */
export interface UseInViewResult<T extends HTMLElement = HTMLDivElement> {
  /** Reference to attach to the target DOM element container. */
  ref: React.RefObject<T | null>;
  /** True once the element has entered the viewport boundary at least once. Stays true permanently. */
  hasEnteredView: boolean;
  /** Real-time boolean indicating whether the element is currently intersecting within the viewport + rootMargin. */
  isIntersecting: boolean;
}

/**
 * Universal React hook tracking viewport proximity via IntersectionObserver.
 * Provides a one-shot trigger (hasEnteredView) for lazy component/canvas initialization,
 * alongside real-time viewport intersection state (isIntersecting) for pausing background work.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options: UseInViewOptions = {}): UseInViewResult<T> {
  const { rootMargin, initialInView = false, enabled = true, once = false } = options;
  const ref = useRef<T | null>(null);
  const [hasEnteredView, setHasEnteredView] = useState(initialInView);
  const [isIntersecting, setIsIntersecting] = useState(initialInView);

  useEffect(() => {
    if (initialInView) {
      setHasEnteredView(true);
      setIsIntersecting(true);
      return;
    }

    if (!enabled) return;

    const el = ref.current;
    if (!el) return;

    const header = document.querySelector<HTMLElement>('header');
    const headerHeight = header ? header.offsetHeight : 80;
    const computedMargin = rootMargin ?? `-${headerHeight}px 0px 400px 0px`;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const visible = entry.isIntersecting;
        setIsIntersecting(visible);

        if (visible) {
          setHasEnteredView(true);
          if (once) {
            observer.disconnect();
          }
        }
      },
      { rootMargin: computedMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, initialInView, enabled, once]);

  return { ref, hasEnteredView, isIntersecting };
}
