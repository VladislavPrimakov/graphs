import { resolveColor, type SemanticColor } from './color';

/** Specification for a single row in an axis, dual, or map tooltip. */
export interface TooltipRowSpec {
  /** Row label text. */
  label?: string;
  /** Primary formatted value string or number. */
  value: string | number;
  /** Optional secondary detail formatted string, e.g. percent share '(24%)'. */
  subValue?: string | number;
  /** Marker dot color. If false, marker dot is hidden. */
  dotColor?: string | false;
  /** Value text color: semantic color variant, Tailwind class, or arbitrary hex/rgb color. */
  color?: SemanticColor | (string & {});
}

/** Summary footer specification for tooltips. */
export interface TooltipFooterSpec {
  /** Summary row label text. */
  label: string;
  /** Summary formatted value string or number. */
  value: string | number;
  /** Value text color: semantic color variant, Tailwind class, or arbitrary hex/rgb color. */
  color?: SemanticColor | (string & {});
}

/** Column definition contract for multi-column tabular tooltips. */
export interface TooltipColumnSpec {
  /** Column header label text. */
  label: string;
  /** Column text alignment. @default 'left' for first column, 'right' for remaining */
  align?: 'left' | 'right' | 'center';
  /** Optional text color token or class for the column header. */
  color?: SemanticColor | (string & {});
}

/** Single row definition for multi-column tabular tooltips. */
export interface TooltipTableRowSpec {
  /** Formatted text values for each table column cell. */
  cells: (string | number)[];
  /** Optional text color tokens or classes corresponding to each column cell. */
  colors?: (SemanticColor | (string & {}) | undefined)[];
  /** Optional icon or silhouette SVG markup string displayed before the first column label. */
  icon?: string;
}

/** Header options for tooltips and map popups. */
export interface TooltipHeaderOptions {
  /** Title text string. */
  title: string;
  /** Optional leading SVG icon string. */
  icon?: string;
  /** Whether to render a subtle bottom border. @default false */
  withBorder?: boolean;
  /** Typography size preset. @default 'xs' */
  size?: 'xs' | 'sm';
}

/** Resolves column alignment class name. */
function getColumnAlignClass(align?: TooltipColumnSpec['align'], colIdx = 0): string {
  if (align === 'center') return 'text-center';
  if (align === 'right' || (!align && colIdx > 0)) return 'text-right';
  return 'text-left';
}

/** Renders circular colored marker dot HTML. */
export function renderTooltipDot(color: string, size = 8): string {
  return `<span class="inline-block rounded-full mr-1.5 shrink-0" style="width:${size}px;height:${size}px;background-color:${color}"></span>`;
}

/** Renders standard header block matching chart and map glassmorphic tooltip specs. */
export function renderTooltipHeader({ title, icon, withBorder = false, size = 'xs' }: TooltipHeaderOptions): string {
  const iconHtml = icon ? `<span class="shrink-0 flex items-center leading-none text-accent-primary">${icon}</span>` : '';
  const borderCls = withBorder || icon ? ' pb-1 border-b border-border-subtle/80' : '';
  const sizeCls = size === 'sm' || icon ? 'text-sm' : 'text-xs';
  return `<div class="font-bold text-accent-primary flex items-center gap-2 mb-2 ${sizeCls}${borderCls}">${iconHtml}<span class="truncate">${title}</span></div>`;
}

/** Renders a single key-value row with color dot, label, and formatted value. */
export function renderTooltipRow(row: TooltipRowSpec, fallbackName = '', fallbackColor = '#60a5fa'): string {
  const dot = row.dotColor !== false ? renderTooltipDot(row.dotColor ?? fallbackColor) : '';
  const { className, styleAttr } = resolveColor(row.color);
  const label = row.label ?? fallbackName;
  const sub = row.subValue !== undefined && row.subValue !== '' ? ` <span class="text-content-muted font-normal ml-1">(${row.subValue})</span>` : '';
  return `<div class="flex items-center justify-between text-xs gap-4"><span class="text-content-secondary flex items-center min-w-0">${dot}<span class="truncate">${label}</span></span><span class="font-semibold shrink-0 ${className}"${styleAttr}>${row.value}${sub}</span></div>`;
}

/** Renders summary footer row with top border. */
export function renderTooltipFooter(footer?: TooltipFooterSpec): string {
  if (!footer) return '';
  const { className, styleAttr } = resolveColor(footer.color, 'primary');
  return `<div class="mt-2 pt-1.5 border-t border-border-subtle/80 flex justify-between items-center text-xs font-bold"><span class="text-content-secondary">${footer.label}:</span><span class="${className}"${styleAttr}>${footer.value}</span></div>`;
}

/** Renders standard glassmorphic key-value table matching chart-builder & MapLibre popup specs. */
export function renderTooltipTablePopup({ title, rows, footer }: { title?: string; rows: TooltipRowSpec[]; footer?: string }): string {
  const headerHtml = title ? renderTooltipHeader({ title, withBorder: true }) : '';
  const rowsHtml = rows
    .map((r, i) => {
      const border = i === rows.length - 1 ? '' : 'border-b border-border-subtle/40';
      const dot =
        typeof r.dotColor === 'string' ? `<span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style="background-color:${r.dotColor};box-shadow:0 0 6px ${r.dotColor}80"></span>` : '';
      const { className, styleAttr } = resolveColor(r.color);
      const sub = r.subValue !== undefined && r.subValue !== '' ? ` <span class="text-content-muted font-normal ml-1">(${r.subValue})</span>` : '';
      return `<tr class="${border}">
        <td class="py-1 text-content-muted font-normal whitespace-nowrap pr-3 align-top flex items-center">${dot}${r.label ? `${r.label}:` : ''}</td>
        <td class="py-1 text-content-primary font-medium text-right wrap-break-word leading-snug ${className}"${styleAttr}>${r.value}${sub}</td>
      </tr>`;
    })
    .join('');

  return `<div class="text-xs min-w-50 max-w-85">
    ${headerHtml}
    <table class="w-full border-collapse text-[11px] mb-1">
      <tbody>${rowsHtml}</tbody>
    </table>
    ${footer ?? ''}
  </div>`;
}

/** Renders complete multi-column table HTML structure. */
export function renderTooltipTableStructure({ columns, rows, footer }: { columns: TooltipColumnSpec[]; rows: TooltipTableRowSpec[]; footer?: TooltipTableRowSpec }): string {
  const colHeaders = columns
    .map((c, i) => {
      const align = getColumnAlignClass(c.align, i);
      const { className, styleAttr } = resolveColor(c.color);
      return `<th class="py-1 px-1.5 font-semibold ${align} ${className}"${styleAttr}>${c.label}</th>`;
    })
    .join('');

  const bodyRows = rows
    .map((r, rowIdx) => {
      const cells = r.cells
        .map((cell, colIdx) => {
          const col = columns[colIdx];
          const align = getColumnAlignClass(col?.align, colIdx);
          const cellColor = r.colors?.[colIdx] ?? col?.color;
          const { className, styleAttr } = resolveColor(cellColor);
          const iconPrefix = colIdx === 0 && r.icon ? `<span class="inline-block mr-1.5 shrink-0">${r.icon}</span>` : '';
          return `<td class="py-1 px-1.5 ${align} ${className}"${styleAttr}>${iconPrefix}${cell}</td>`;
        })
        .join('');
      const border = rowIdx === rows.length - 1 && !footer ? '' : 'border-b border-border-subtle/40';
      return `<tr class="${border}">${cells}</tr>`;
    })
    .join('');

  let footerHtml = '';
  if (footer) {
    const footerCells = footer.cells
      .map((cell, colIdx) => {
        const col = columns[colIdx];
        const align = getColumnAlignClass(col?.align, colIdx);
        const cellColor = footer.colors?.[colIdx] ?? col?.color ?? 'primary';
        const { className, styleAttr } = resolveColor(cellColor);
        return `<td class="py-1.5 px-1.5 font-bold ${align} ${className}"${styleAttr}>${cell}</td>`;
      })
      .join('');
    footerHtml = `<tfoot><tr class="border-t border-border-subtle/80">${footerCells}</tr></tfoot>`;
  }

  return `<table class="w-full text-[11px] tabular-nums border-collapse"><thead><tr class="border-b border-border-subtle/80 text-content-muted">${colHeaders}</tr></thead><tbody>${bodyRows}</tbody>${footerHtml}</table>`;
}
