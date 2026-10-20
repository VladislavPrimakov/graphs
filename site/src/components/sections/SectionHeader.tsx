import type { ReactNode } from 'react';
import { AnchorButton } from '@/components/ui/AnchorButton';

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
 * centered title, and clean responsive layout without JavaScript measurement overhead.
 *
 * On wide screens, pins AnchorButton to the left, action button to the right, and centers the title.
 * On narrow screens, stacks the title on top and places the AnchorButton cleanly below.
 */
export const SectionHeader = ({ sectionId, projectSlug, title, actions }: SectionHeaderProps) => {
  return (
    <div className="relative flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 mb-3 min-h-7">
      <div className="order-2 sm:order-1 sm:absolute sm:left-0 shrink-0">
        <AnchorButton sectionId={sectionId} projectSlug={projectSlug} />
      </div>
      {title && <h3 className="order-1 sm:order-2 text-base font-bold text-content-primary tracking-tight leading-7 text-center sm:px-12">{title}</h3>}
      {actions && <div className="order-3 sm:absolute sm:right-0 shrink-0">{actions}</div>}
    </div>
  );
};
