import type React from 'react';
import { useEffect, useState } from 'react';

import { cn } from '@/utils/cn';

/** Props for the LoadingSpinner component. */
export interface LoadingSpinnerProps {
  /** Controls visibility with smooth fade-out transition. @default true */
  isVisible?: boolean;
  /** Whether to render as fixed full-screen overlay or relative/absolute container inside a card. @default true */
  fullscreen?: boolean;
  /** Visual scale of the radar ring and equalizer bars. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
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
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!mounted) return null;

  const isSm = size === 'sm';
  const ringSizeClass = isSm ? 'w-14 h-14' : size === 'lg' ? 'w-28 h-28' : 'w-24 h-24';
  const barsContainerClass = isSm ? 'h-6 px-1 pb-0.5 gap-1' : 'h-10 px-2 pb-1 gap-1.5';
  const barWidthClass = isSm ? 'w-1.5' : 'w-2';

  const overlayClass = fullscreen
    ? cn(
        'loading-spinner-overlay fixed inset-0 z-50 flex items-center justify-center bg-surface-base/95 backdrop-blur-md transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )
    : cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-surface-card/60 backdrop-blur-sm rounded-xl transition-opacity duration-300 pointer-events-none',
        active ? 'opacity-100' : 'opacity-0',
      );

  return (
    <div className={overlayClass}>
      <div className="relative flex items-center justify-center">
        {/* Glowing backdrop halo */}
        <div className={`absolute -inset-4 rounded-full bg-accent-glow blur-2xl pointer-events-none ${isSm ? 'opacity-40' : 'opacity-60'}`} />

        {/* Outer spinning radar / coordinate ring */}
        <div className={`${ringSizeClass} rounded-full border-2 border-border-subtle border-t-accent-primary animate-spin shadow-lg shadow-accent-glow/20`} />

        {/* Inner static coordinate frame with animated bar chart equalizer */}
        <div className={`absolute flex items-end ${barsContainerClass}`}>
          {/* Bar 1 */}
          <div
            className={`${barWidthClass} bg-linear-to-t from-blue-600 to-accent-primary rounded-full animate-pulse`}
            style={{
              height: '55%',
              animationDuration: '1.2s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
          {/* Bar 2 */}
          <div
            className={`${barWidthClass} bg-linear-to-t from-indigo-600 to-accent-hover rounded-full animate-pulse`}
            style={{
              height: '85%',
              animationDuration: '0.9s',
              animationDelay: '0.2s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
          {/* Bar 3 */}
          <div
            className={`${barWidthClass} bg-linear-to-t from-blue-500 to-sky-400 rounded-full animate-pulse`}
            style={{
              height: '40%',
              animationDuration: '1.4s',
              animationDelay: '0.4s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
          {/* Bar 4 */}
          <div
            className={`${barWidthClass} bg-linear-to-t from-indigo-500 to-accent-primary rounded-full animate-pulse`}
            style={{
              height: '100%',
              animationDuration: '1.0s',
              animationDelay: '0.1s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
          {/* Bar 5 */}
          <div
            className={`${barWidthClass} bg-linear-to-t from-blue-600 to-accent-hover rounded-full animate-pulse`}
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
    </div>
  );
};
