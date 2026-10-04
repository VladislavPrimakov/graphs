import type React from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { WarLossMapDataset } from '@/types';
import type { dict as enDict } from '../locales/dict-en';

// Dynamic import of heavy WebGL MapLibre component
const LossesMapLazy = lazy(() => import('./LossesMap').then((m) => ({ default: m.LossesMap })));

interface LazyLossesMapProps {
  data: WarLossMapDataset;
  t: typeof enDict;
}

export const LazyLossesMap: React.FC<LazyLossesMapProps> = ({ data, t }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }, // pre-load 300px before scrolling into view
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isInView]);

  return (
    <div ref={containerRef} className="relative w-full min-h-145">
      {isInView ? (
        <Suspense
          fallback={
            <div className="relative w-full h-145 card">
              <LoadingSpinner isVisible={true} fullscreen={false} size="md" />
            </div>
          }
        >
          <LossesMapLazy data={data} t={t} />
        </Suspense>
      ) : (
        <div className="relative w-full h-145 card">
          <LoadingSpinner isVisible={true} fullscreen={false} size="md" />
        </div>
      )}
    </div>
  );
};
