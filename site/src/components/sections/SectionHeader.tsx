import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSectionResize } from '@/components/sections/Section';
import { AnchorButton } from '@/components/ui/AnchorButton';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Props for the unified polymorphic SectionHeader component. */
export interface SectionHeaderProps {
  /** Section ID used for anchor links. */
  sectionId: string;
  /** Unique project slug identifier for anchor links. */
  projectSlug?: string;
  /** Section title text displayed centrally in the header. */
  title?: string;
  /** Optional interactive action widgets (e.g., expand/collapse categories). */
  actions?: ReactNode;
}

/**
 * Unified section header component providing consistent anchor links,
 * mathematically centered title with symmetrical balancing, and automatic
 * row wrapping whenever the title cannot fit in a single row without wrapping.
 */
export const SectionHeader = ({ sectionId, projectSlug, title, actions }: SectionHeaderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isStacked, setIsStacked] = useState(false);

  const checkFit = () => {
    if (!title) return;
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    const titleWidth = measureRef.current?.offsetWidth ?? 0;
    const anchorWidth = anchorRef.current?.offsetWidth ?? 160;
    const GAP_PX = 16;
    const totalNeeded = titleWidth + anchorWidth * 2 + GAP_PX * 2;

    setIsStacked(containerWidth < totalNeeded);
  };

  useIsomorphicLayoutEffect(() => {
    checkFit();
  }, [title]);

  useSectionResize(checkFit);

  const symmetricalSlot = (
    <div className="flex items-center justify-end shrink-0" aria-hidden={!actions}>
      {actions ?? (
        <div className="invisible pointer-events-none select-none">
          <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
        </div>
      )}
    </div>
  );

  return (
    <>
      {title && (
        <span
          ref={measureRef}
          className="invisible fixed -top-[9999px] -left-[9999px] text-base font-bold tracking-tight leading-snug whitespace-nowrap pointer-events-none select-none"
          aria-hidden="true"
        >
          {title}
        </span>
      )}

      <div ref={containerRef} className="w-full mb-3">
        {isStacked ? (
          <div className="flex flex-col items-center gap-2">
            {title && <h3 className="text-center text-base font-bold text-content-primary tracking-tight leading-snug w-full">{title}</h3>}
            <div className="relative flex items-center justify-center w-full">
              <div ref={anchorRef} className="shrink-0">
                <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
              </div>
              {actions && <div className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0">{actions}</div>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 min-h-7">
            <div ref={anchorRef} className="justify-self-start shrink-0">
              <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
            </div>
            {title && <h3 className="justify-self-center text-center text-base font-bold text-content-primary tracking-tight leading-snug">{title}</h3>}
            {symmetricalSlot}
          </div>
        )}
      </div>
    </>
  );
};
