/** Renders an inline colored circular dot marker for ECharts tooltips. */
export function createTooltipDot(color: string, size = 8): string {
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background-color:${color};margin-right:6px;flex-shrink:0;"></span>`;
}

/** Renders a standardized header block for chart tooltips. */
export function createTooltipHeader(title: string, subtitle?: string): string {
  let html = `<div class="font-bold text-accent-primary mb-2">${title}</div>`;
  if (subtitle) {
    html += `<div class="text-[11px] text-content-muted mb-2 -mt-1">${subtitle}</div>`;
  }
  return html;
}

/** Options for customizing a tooltip key-value row. */
export interface TooltipRowOptions {
  /** Marker dot color code. */
  dotColor?: string;
  /** Custom CSS classes for the label text. @default 'text-content-secondary' */
  labelClass?: string;
  /** Custom CSS classes for the value text. @default 'font-semibold text-content-primary' */
  valueClass?: string;
}

/** Renders a single key-value metric row with optional colored dot marker. */
export function createTooltipRow(label: string, value: string | number, options: TooltipRowOptions = {}): string {
  const { dotColor, labelClass = 'text-content-secondary', valueClass = 'font-semibold text-content-primary' } = options;
  const dot = dotColor ? createTooltipDot(dotColor) : '';
  const formattedVal = typeof value === 'number' ? value.toLocaleString() : value;

  return `<div class="flex items-center justify-between text-xs gap-4">
    <span class="${labelClass} flex items-center">${dot}${label}</span>
    <span class="${valueClass}">${formattedVal}</span>
  </div>`;
}

/** Renders a horizontal divider line inside a tooltip. */
export function createTooltipDivider(): string {
  return '<div class="mt-2 pt-1.5 border-t border-border-subtle/80"></div>';
}

/** Renders a total summary footer row inside a tooltip. */
export function createTooltipTotal(label: string, value: string | number, colorClass = 'text-accent-hover'): string {
  const formattedVal = typeof value === 'number' ? value.toLocaleString() : value;
  return `<div class="mt-2 pt-1 border-t border-border-subtle/80 flex justify-between text-xs font-bold ${colorClass}">
    <span>${label}:</span>
    <span>${formattedVal}</span>
  </div>`;
}
