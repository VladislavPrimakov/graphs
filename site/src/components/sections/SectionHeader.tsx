import { Children, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** Interactive control widgets (sliders, toggles, checkboxes). */
  controls?: ReactNode;
  /** Action buttons (e.g., expand/collapse categories). */
  actions?: ReactNode;
}

/**
 * Unified polymorphic section header component providing consistent anchor links,
 * perfect mathematical title centering, and controls/actions layout across all section types (charts, maps, breakdown grids, loaders).
 *
 * 1-row layout uses CSS Grid `grid-template-columns: 1fr auto 1fr` with `items-start`, ensuring the title is ALWAYS in the exact center of the card.
 * As soon as the title and first control cannot fit without wrapping, seamlessly splits into a centered title row on top and utility bar below.
 */
export const SectionHeader = ({ sectionId, projectSlug, title, controls, actions }: SectionHeaderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const firstActionRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isStacked, setIsStacked] = useState(false);

  const rawActions = controls || actions;
  const items = Children.toArray(rawActions).filter(Boolean);
  const firstAction = items[0] ?? null;
  const remainingActions = items.slice(1);

  const lastActionWidthRef = useRef(0);
  const lastAnchorWidthRef = useRef(28);

  useIsomorphicLayoutEffect(() => {
    if (!title) return;

    const container = containerRef.current;
    if (!container) return;

    const checkFit = () => {
      const containerWidth = container.offsetWidth;
      if (containerWidth === 0) return;

      const titleWidth = measureRef.current?.offsetWidth ?? 0;

      const rawAnchorWidth = anchorRef.current?.offsetWidth ?? 0;
      if (rawAnchorWidth > 0) lastAnchorWidthRef.current = rawAnchorWidth;
      const anchorWidth = rawAnchorWidth || lastAnchorWidthRef.current;

      const rawActionWidth = firstAction ? (firstActionRef.current?.offsetWidth ?? 0) : 0;
      if (rawActionWidth > 0) lastActionWidthRef.current = rawActionWidth;
      const firstActionWidth = firstAction ? rawActionWidth || lastActionWidthRef.current : 0;

      // In 1fr auto 1fr grid with gap-3 (12px), there are exactly 2 gaps between the 3 columns.
      // Both side columns require at least max(anchorWidth, firstActionWidth) to keep the center column mathematically centered.
      const GRID_GAP_PX = 12; // gap-3 = 0.75rem = 12px
      const TOTAL_GAPS_PX = GRID_GAP_PX * 2; // 2 gaps between the 3 columns
      const sideWidth = Math.max(anchorWidth, firstActionWidth);
      const totalNeeded = titleWidth + sideWidth * 2 + TOTAL_GAPS_PX;

      setIsStacked(containerWidth < totalNeeded);
    };

    checkFit();

    const resizeObserver = new ResizeObserver(checkFit);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [title, rawActions]);

  return (
    <>
      {/* Invisible off-screen element measuring exact single-line text width in current font/locale */}
      {title && (
        <span
          ref={measureRef}
          className="invisible fixed -top-[9999px] -left-[9999px] text-base font-bold tracking-tight leading-7 whitespace-nowrap pointer-events-none select-none"
          aria-hidden="true"
        >
          {title}
        </span>
      )}

      <div ref={containerRef} className="flex flex-col mb-3">
        {isStacked ? (
          <div className="flex flex-col gap-2.5">
            {title && <h3 className="text-base font-bold text-content-primary tracking-tight leading-7 text-center w-full">{title}</h3>}
            <div className="flex flex-wrap items-start justify-between gap-2 w-full">
              <div ref={anchorRef} className="shrink-0">
                <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
              </div>
              {items.length > 0 && (
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto max-w-full">
                  <div ref={firstActionRef} className="shrink-0 max-w-full">
                    {firstAction}
                  </div>
                  {remainingActions}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Top row: 3-column symmetrical grid containing Anchor, Centered Title, and First Action ONLY */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 min-h-7">
              <div ref={anchorRef} className="col-start-1 justify-self-start shrink-0">
                <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
              </div>
              {title && <h3 className="col-start-2 justify-self-center text-center text-base font-bold text-content-primary tracking-tight leading-7">{title}</h3>}
              <div ref={firstActionRef} className="col-start-3 justify-self-end shrink-0">
                {firstAction}
              </div>
            </div>

            {/* Subsequent rows: remaining controls cleanly stacked below row 1 */}
            {remainingActions.length > 0 && <div className="flex flex-col items-end gap-1.5 mt-1.5 shrink-0">{remainingActions}</div>}
          </>
        )}
      </div>
    </>
  );
};
