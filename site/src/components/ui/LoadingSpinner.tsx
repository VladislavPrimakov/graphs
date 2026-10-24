import type React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

let initialLoaderDismissed = false;
const dismissListeners = new Set<() => void>();

/** Dismisses the initial page loading veil with a smooth 200ms transition. */
export function dismissInitialLoader(): void {
  if (initialLoaderDismissed) return;
  initialLoaderDismissed = true;
  for (const listener of dismissListeners) {
    listener();
  }
}

/** Props for the LoadingSpinner component. */
export interface LoadingSpinnerProps {
  /** Controls visibility with smooth fade-out transition. @default true */
  isVisible?: boolean;
  /** Whether to render as fixed full-screen overlay or relative/absolute container inside a card. @default true */
  fullscreen?: boolean;
  /** Visual scale of the radar ring and equalizer bars. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
}

function SpinnerVisual({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const isSm = size === 'sm';
  const ringSizeClass = isSm ? 'w-14 h-14' : size === 'lg' ? 'w-28 h-28' : 'w-24 h-24';
  const barsContainerClass = isSm ? 'h-6 px-1 pb-0.5 gap-1' : 'h-10 px-2 pb-1 gap-1.5';
  const barWidthClass = isSm ? 'w-1.5' : 'w-2';

  return (
    <div className="relative flex items-center justify-center">
      {/* Glowing backdrop halo */}
      <div className={`absolute -inset-4 rounded-full bg-accent-glow blur-2xl pointer-events-none ${isSm ? 'opacity-40' : 'opacity-60'}`} />

      {/* Outer spinning radar / coordinate ring */}
      <div className={`${ringSizeClass} rounded-full border-2 border-border-subtle border-t-accent-primary animate-spin shadow-lg shadow-accent-glow/20`} />

      {/* Inner static coordinate frame with animated bar chart equalizer */}
      <div className={`absolute flex items-end ${barsContainerClass}`}>
        <div
          className={`${barWidthClass} bg-linear-to-t from-accent-primary to-accent-hover rounded-full animate-pulse`}
          style={{
            height: '55%',
            animationDuration: '1.2s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
        <div
          className={`${barWidthClass} bg-linear-to-t from-accent-hover to-accent-primary rounded-full animate-pulse`}
          style={{
            height: '85%',
            animationDuration: '0.9s',
            animationDelay: '0.2s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
        <div
          className={`${barWidthClass} bg-linear-to-t from-accent-primary/80 to-accent-hover rounded-full animate-pulse`}
          style={{
            height: '40%',
            animationDuration: '1.4s',
            animationDelay: '0.4s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
        <div
          className={`${barWidthClass} bg-linear-to-t from-accent-hover to-accent-primary rounded-full animate-pulse`}
          style={{
            height: '100%',
            animationDuration: '1.0s',
            animationDelay: '0.1s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
        <div
          className={`${barWidthClass} bg-linear-to-t from-accent-primary to-accent-hover rounded-full animate-pulse`}
          style={{
            height: '65%',
            animationDuration: '1.3s',
            animationDelay: '0.3s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      </div>
    </div>
  );
}

/** Thematic loading spinner featuring animated analytical chart bars and glowing orbital radar ring. */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ isVisible = true, fullscreen = true, size = fullscreen ? 'md' : 'sm' }) => {
  const [mounted, setMounted] = useState(isVisible);
  const [active, setActive] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      requestAnimationFrame(() => setActive(true));
    } else {
      setActive(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!mounted) return null;

  const overlayClass = fullscreen
    ? cn(
        'loading-spinner-overlay fixed inset-0 z-50 flex items-center justify-center bg-surface-base/95 backdrop-blur-md transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )
    : cn(
        'loading-spinner-overlay absolute inset-0 z-10 flex items-center justify-center bg-surface-card/60 backdrop-blur-sm rounded-xl transition-opacity duration-200 pointer-events-none',
        active ? 'opacity-100' : 'opacity-0',
      );

  return (
    <div data-loading-spinner className={overlayClass}>
      <SpinnerVisual size={size} />
    </div>
  );
};

/** Initial full-screen loading veil active by default in pre-rendered SSG HTML until the page is fully ready. */
export const InitialLoadingVeil: React.FC = () => {
  const [mounted, setMounted] = useState(!initialLoaderDismissed);
  const [active, setActive] = useState(!initialLoaderDismissed);

  useEffect(() => {
    if (initialLoaderDismissed) {
      setActive(false);
      setMounted(false);
      return;
    }

    const onDismiss = () => {
      setActive(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    };

    dismissListeners.add(onDismiss);

    return () => {
      dismissListeners.delete(onDismiss);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      id="initial-loading-veil"
      data-loading-spinner
      className={cn(
        'loading-spinner-overlay fixed inset-0 z-50 flex items-center justify-center bg-surface-base/95 backdrop-blur-md transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
    >
      <SpinnerVisual size="md" />
    </div>
  );
};

/** Centered content-area loading placeholder for route transitions under the site header. */
export const PageLoader: React.FC = () => {
  return (
    <div data-loading-spinner className="flex-1 flex items-center justify-center min-h-[50vh] py-16">
      <SpinnerVisual size="md" />
    </div>
  );
};
