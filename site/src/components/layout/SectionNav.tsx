import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { useScrollSpy } from '@/utils/useScrollSpy';

/** Props for the SectionNav outline component. */
export interface SectionNavProps {
  /** Array of section anchor IDs (e.g. ['payload-capacity', 'launch-costs']). */
  anchors: string[];
  /** Optional active anchor ID override (defaults to internally spied activeId). */
  activeId?: string;
}

/** Horizontal outline navigation pill bar rendered into header center slot via React Portal. */
export const SectionNav: React.FC<SectionNavProps> = ({ anchors, activeId: propActiveId }) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const spiedActiveId = useScrollSpy();
  const activeId = propActiveId ?? spiedActiveId;
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-section-nav'));
  }, []);

  // Auto-center active pill within horizontal scroll container
  useEffect(() => {
    if (!containerRef.current || !activeId) return;
    const activePill = containerRef.current.querySelector<HTMLElement>(`[data-nav-anchor="${activeId}"]`);
    if (activePill) {
      const container = containerRef.current;
      const targetScrollLeft = activePill.offsetLeft - container.offsetWidth / 2 + activePill.offsetWidth / 2;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [activeId]);

  if (!portalTarget || anchors.length <= 1) return null;

  return createPortal(
    <nav
      aria-label="Section navigation"
      ref={containerRef}
      className="flex items-center justify-center-safe gap-1.5 overflow-x-auto scrollbar-none py-1 max-w-full px-2 mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
    >
      {anchors.map((anchor) => {
        const isActive = activeId === anchor;

        return (
          <a
            key={anchor}
            href={`#${anchor}`}
            data-nav-anchor={anchor}
            onClick={(e) => {
              const target = document.querySelector<HTMLElement>(`[data-anchor-section="${anchor}"], #${CSS.escape(anchor)}`);
              if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
                history.replaceState(null, '', `#${anchor}`);
              }
            }}
            className={cn('nav-pill shrink-0 whitespace-nowrap', isActive ? 'nav-pill-active' : 'nav-pill-idle')}
          >
            #{anchor}
          </a>
        );
      })}
    </nav>,
    portalTarget,
  );
};
