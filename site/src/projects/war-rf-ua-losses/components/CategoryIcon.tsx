import type { WarLossCategory } from '@/types';
import { CATEGORY_SVG_PATHS } from './category-markers';

export interface CategoryIconProps {
  category: WarLossCategory;
  className?: string;
}

/** Vector silhouette icon for a specific military equipment loss category. */
export function CategoryIcon({ category, className = 'h-3 w-auto shrink-0' }: CategoryIconProps) {
  const path = CATEGORY_SVG_PATHS[category];
  if (!path) return null;

  return (
    <svg viewBox="0 0 52 18" className={className} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** Returns inline SVG markup string for a military equipment category silhouette. */
export function getCategoryIconSvg(category: WarLossCategory, heightPx = 13, className = 'shrink-0'): string {
  const path = CATEGORY_SVG_PATHS[category];
  if (!path) return '';
  return `<svg viewBox="0 0 52 18" class="${className}" style="height:${heightPx}px;width:auto;display:inline-block;vertical-align:middle;" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}
