import type React from 'react';
import { useState } from 'react';

/** Props for the container card wrapping charts and optional controls. */
export interface ChartCardProps {
  /** Optional HTML id attribute for the card element for DOM targeting. */
  id?: string;
  /** Anchor identifier displayed and copied. If omitted, defaults to id. */
  anchorId?: string;
  /** Optional interactive controls (e.g., granularity toggle buttons) rendered in the card header. */
  headerRight?: React.ReactNode;
  /** Chart canvas, table, or child widget elements. */
  children: React.ReactNode;
  /** Optional additional CSS classes. @default '' */
  className?: string;
}

/** Container card with backdrop blur, deep-link anchor support, and border accents for wrapping ECharts visualizations and controls. */
export const ChartCard: React.FC<ChartCardProps> = ({ id, anchorId, headerRight, children, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const activeAnchor = anchorId || id;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeAnchor) return;
    const url = `${window.location.origin}${window.location.pathname}#${activeAnchor}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for environments where clipboard permissions are restricted
      });
    history.replaceState(null, '', `#${activeAnchor}`);
  };

  const hasHeader = Boolean(activeAnchor || headerRight);

  return (
    <div id={id} className={`bg-surface-card border border-border-subtle/80 rounded-2xl p-4 sm:p-6 shadow-xl relative group ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-2 absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 pointer-events-none z-10">
          <div className="pointer-events-auto">
            {activeAnchor ? (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-base/70 hover:bg-surface-elevated border border-border-subtle/70 hover:border-border-muted text-[11px] font-mono font-medium text-content-muted hover:text-accent-primary transition-all group/btn cursor-pointer backdrop-blur-sm shadow-sm"
                title={`Copy direct link to #${activeAnchor}`}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-status-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-status-success font-semibold">Copied link!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-content-dim group-hover/btn:text-accent-primary shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span>#{activeAnchor}</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
          {headerRight && <div className="pointer-events-auto">{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default ChartCard;
