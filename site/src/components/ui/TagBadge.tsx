import type React from 'react';
import type { ProjectTag } from '@/types';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/utils/provider';

/** Props for the TagBadge component. */
export interface TagBadgeProps {
  /** Tag slug identifier. */
  tag: ProjectTag;
  /** Whether the tag acts as an interactive clickable button. @default false */
  interactive?: boolean;
  /** Optional additional CSS class names. @default '' */
  className?: string;
  /** Click handler callback when interactive is true. */
  onClick?: (tag: ProjectTag) => void;
}

/** Semantic badge pill displaying project categorization tags with mapped theme colors. */
export const TagBadge: React.FC<TagBadgeProps> = ({ tag, interactive = false, className, onClick }) => {
  const { getTagLabel } = useTranslation();
  const label = getTagLabel(tag);

  if (interactive) {
    return (
      <button
        type="button"
        data-tag={tag}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick?.(tag);
        }}
        className={cn('tag-pill hover:scale-105 cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-primary/50', className)}
      >
        {label}
      </button>
    );
  }

  return (
    <span data-tag={tag} className={cn('tag-pill', className)}>
      {label}
    </span>
  );
};
