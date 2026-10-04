/** Semantic color variant names mapped to theme typography utility classes. */
export type SemanticColor = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'muted';

/** Map of semantic color variants to Tailwind typography utility classes. */
export const SEMANTIC_COLORS: Record<SemanticColor, string> = {
  default: 'text-content-primary',
  primary: 'text-accent-primary',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  info: 'text-status-info',
  blue: 'text-accent-blue',
  muted: 'text-content-muted',
};

/** Result of resolving a semantic, Tailwind, or direct CSS color. */
export interface ResolvedColor {
  /** Resolved Tailwind CSS class name. */
  className: string;
  /** React inline style object for direct colors, or undefined. */
  style?: { color: string };
  /** HTML style attribute string for direct colors, or empty string. */
  styleAttr: string;
}

/** Checks whether a color string is a raw CSS color value (hex, rgb, rgba, hsl, hsla). */
function isDirectColor(color?: string): boolean {
  if (!color) return false;
  return color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl');
}

/**
 * Resolves a semantic color name, Tailwind text class, or raw CSS color (hex/rgb/hsl)
 * into a CSS class name and inline style attributes for both React and HTML contexts.
 */
export function resolveColor(color?: SemanticColor | (string & {}), defaultColor: SemanticColor | string = 'default'): ResolvedColor {
  const target = color || defaultColor;
  if (!target) {
    return { className: '', styleAttr: '' };
  }

  if (isDirectColor(target)) {
    return {
      className: '',
      style: { color: target },
      styleAttr: ` style="color:${target}"`,
    };
  }

  const semanticClass = SEMANTIC_COLORS[target as SemanticColor];
  return {
    className: semanticClass || target,
    styleAttr: '',
  };
}
