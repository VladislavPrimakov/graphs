import type React from 'react';
import { useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useFormat, useTranslation } from '@/utils/provider';

/** Props for the interactive TimelineScrubber component. */
export type TimelineScrubberProps =
  | {
      /** Range selection mode with two handles and middle window dragging (default). */
      mode?: 'range';
      /** Sequential period identifiers spanning the full timeline (e.g. `['2022-02', '2022-03', ...]`). */
      periods: string[];
      /** Numeric event counts for the background density histogram matching `periods` 1:1. */
      density?: number[];
      /** Currently active start date (`YYYY-MM-DD` or `YYYY-MM`), or empty string for all time. */
      dateFrom: string;
      /** Currently active end date (`YYYY-MM-DD` or `YYYY-MM`), or empty string for all time. */
      dateTo: string;
      /** Callback fired when the selection window or year preset changes. */
      onChange: (range: { dateFrom: string; dateTo: string }) => void;
      selectedDate?: never;
      onSelectDate?: never;
      /** Additional container CSS class names. */
      className?: string;
    }
  | {
      /** Single date selection mode with a single draggable handle. */
      mode: 'single';
      /** Sequential period identifiers spanning the full timeline (e.g. daily `['2023-01-28', ...]`). */
      periods: string[];
      /** Numeric event counts for the background density histogram matching `periods` 1:1. */
      density?: number[];
      /** Currently active selected date (`YYYY-MM-DD` or `YYYY-MM`). */
      selectedDate: string;
      /** Callback fired when the active date changes. */
      onSelectDate: (date: string) => void;
      dateFrom?: never;
      dateTo?: never;
      onChange?: never;
      /** Additional container CSS class names. */
      className?: string;
    };

/** Resolves the last calendar day for a given `YYYY-MM` month string. */
function getLastDayOfMonth(period: string): string {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  return String(lastDay).padStart(2, '0');
}

/** Formats a `YYYY-MM` or `YYYY-MM-DD` period into a localized label (e.g. 'Feb 2022' or '28 Jan 2023'). */
function formatPeriodLabel(fmt: ReturnType<typeof useFormat>, period: string): string {
  if (!period) return '';
  const parts = period.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return fmt.date(d, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const [y, m] = parts;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return fmt.date(d, { month: 'short', year: 'numeric' });
}

interface PresetChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

/** Reusable preset button chip for quick navigation between years or all time. */
function PresetChip({ label, isActive, onClick }: PresetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
        isActive ? 'btn-accent font-semibold shadow-xs' : 'btn-subtle text-content-muted hover:text-content-primary',
      )}
    >
      {label}
    </button>
  );
}

interface ScrubberThumbProps {
  percent: number;
  title: string;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/** Unified draggable handle with pointer capture and glowing active ring. */
function ScrubberThumb({ percent, title, isDragging, onPointerDown, onPointerMove, onPointerUp }: ScrubberThumbProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: `${percent}%` }}
      className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize group z-20 touch-none"
      title={title}
    >
      <div
        className={cn(
          'w-2 h-6 rounded-xs bg-accent-primary border border-white/20 shadow-xs flex items-center justify-center transition-transform',
          'group-hover:scale-110 group-hover:bg-accent-hover',
          isDragging && 'scale-115 ring-2 ring-accent-primary/40',
        )}
      >
        <div className="w-0.5 h-3 bg-white/70 rounded-full" />
      </div>
    </div>
  );
}

interface YearEntry {
  year: string;
  firstIdx: number;
  lastIdx: number;
  firstPeriod: string;
  lastPeriod: string;
}

/** Precomputes unique year metadata and start/end boundaries for preset chips and tick marks. */
function computeYearEntries(periods: string[]): YearEntry[] {
  const yearEntries: YearEntry[] = [];
  const yearMap = new Map<string, YearEntry>();
  const total = periods.length;

  for (let i = 0; i < total; i++) {
    const y = periods[i].slice(0, 4);
    const existing = yearMap.get(y);
    if (!existing) {
      const entry: YearEntry = { year: y, firstIdx: i, lastIdx: i, firstPeriod: periods[i], lastPeriod: periods[i] };
      yearMap.set(y, entry);
      yearEntries.push(entry);
    } else {
      existing.lastIdx = i;
      existing.lastPeriod = periods[i];
    }
  }
  return yearEntries;
}

interface DensityBar {
  key: string;
  xPercent: number;
  widthPercent: number;
  heightPercent: number;
  centerPercent: number;
}

/** Normalizes and samples density bars down to max 100 bars for smooth 60 FPS rendering and crisp gaps. */
function computeDensityBars(density: number[] | undefined, periods: string[]): DensityBar[] {
  if (!density || density.length === 0) return [];
  const n = density.length;

  if (n <= 100) {
    const maxVal = Math.max(...density, 0.001);
    const barWidth = Math.max(0.4, 100 / n - 0.25);
    return density.map((val, idx) => ({
      key: periods[idx] || String(idx),
      xPercent: (idx / n) * 100,
      widthPercent: barWidth,
      heightPercent: val > 0 ? Math.max(4, (val / maxVal) * 85) : 0,
      centerPercent: ((idx + 0.5) / n) * 100,
    }));
  }

  const bins = 100;
  const binSize = n / bins;
  const barWidth = 100 / bins - 0.25;

  const binValues: number[] = [];
  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * binSize);
    const end = Math.floor((b + 1) * binSize);
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += density[i] || 0;
    }
    binValues.push(sum);
  }

  const maxBarVal = Math.max(...binValues, 0.001);

  return binValues.map((val, b) => ({
    key: `bin-${b}`,
    xPercent: (b / bins) * 100,
    widthPercent: barWidth,
    heightPercent: val > 0 ? Math.max(4, (val / maxBarVal) * 85) : 0,
    centerPercent: ((b + 0.5) / bins) * 100,
  }));
}

const SELECTION_ZONE_BASE = 'absolute top-0 bottom-0 bg-accent-primary/20 border-y border-accent-primary/40 transition-colors';
const SELECTION_ZONE_ACTIVE = 'bg-accent-primary/30 border-accent-primary/70';

/**
 * Interactive timeline scrubber control featuring:
 * - Dual-thumb interval resizing and window dragging in 'range' mode
 * - Single-thumb precision date scrubbing in 'single' mode
 * - Year preset chips and quick-jump navigation
 * - Lightweight SVG data density mini-histogram
 * - Year tick markers and active period status badge
 */
export function TimelineScrubber(props: TimelineScrubberProps) {
  const { periods, density = [], className } = props;
  const isSingle = props.mode === 'single';

  const {
    t: { common: tCommon },
  } = useTranslation();
  const fmt = useFormat();

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | 'window' | 'single' | null>(null);

  const dragInfoRef = useRef<{
    pointerId: number;
    startX: number;
    initialStartIdx: number;
    initialEndIdx: number;
    trackWidth: number;
  }>({
    pointerId: 0,
    startX: 0,
    initialStartIdx: 0,
    initialEndIdx: 0,
    trackWidth: 0,
  });

  const totalPeriods = periods.length;
  if (totalPeriods === 0) return null;

  // Single mode state
  let singleIdx = 0;
  if (isSingle) {
    singleIdx = props.selectedDate ? periods.indexOf(props.selectedDate) : totalPeriods - 1;
    if (singleIdx < 0) singleIdx = totalPeriods - 1;
  }

  // Range mode state
  const fromMonth = !isSingle && props.dateFrom ? props.dateFrom.slice(0, 7) : '';
  const toMonth = !isSingle && props.dateTo ? props.dateTo.slice(0, 7) : '';

  let startIdx = fromMonth ? periods.indexOf(fromMonth) : 0;
  if (startIdx < 0) startIdx = 0;

  let endIdx = toMonth ? periods.indexOf(toMonth) : totalPeriods - 1;
  if (endIdx < 0) endIdx = totalPeriods - 1;

  if (startIdx > endIdx) {
    startIdx = endIdx;
  }

  // Precompute year metadata and density bars via pure module functions
  const yearEntries = computeYearEntries(periods);
  const densityBars = computeDensityBars(density, periods);

  // Detect currently active year preset in range mode
  const isAllTime = !isSingle && !props.dateFrom && !props.dateTo;
  let activeYearPreset: string | null = isAllTime ? 'all' : null;

  if (!isSingle && !isAllTime) {
    for (const entry of yearEntries) {
      if (fromMonth === entry.firstPeriod && toMonth === entry.lastPeriod) {
        activeYearPreset = entry.year;
        break;
      }
    }
  }

  const singleYear = isSingle ? periods[singleIdx]?.slice(0, 4) : null;

  // Percentage calculations
  const leftPercent = totalPeriods > 1 ? (startIdx / (totalPeriods - 1)) * 100 : 0;
  const rightPercent = totalPeriods > 1 ? (endIdx / (totalPeriods - 1)) * 100 : 100;
  const widthPercent = Math.max(0, rightPercent - leftPercent);
  const singlePercent = totalPeriods > 1 ? (singleIdx / (totalPeriods - 1)) * 100 : 100;

  // Emit updated date range from indices (range mode)
  const commitIndices = (nextStart: number, nextEnd: number) => {
    if (props.mode === 'single') return;
    if (nextStart === 0 && nextEnd === totalPeriods - 1) {
      props.onChange({ dateFrom: '', dateTo: '' });
      return;
    }
    const nextStartPeriod = periods[nextStart];
    const nextEndPeriod = periods[nextEnd];
    const nextFrom = `${nextStartPeriod}-01`;
    const nextTo = `${nextEndPeriod}-${getLastDayOfMonth(nextEndPeriod)}`;
    props.onChange({ dateFrom: nextFrom, dateTo: nextTo });
  };

  // Drag handlers with pointer capture
  const handlePointerDown = (type: 'left' | 'right' | 'window' | 'single', e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = trackRef.current.getBoundingClientRect();
    dragInfoRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      initialStartIdx: isSingle ? singleIdx : startIdx,
      initialEndIdx: isSingle ? singleIdx : endIdx,
      trackWidth: rect.width,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDragging(type);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !trackRef.current) return;
    const { startX, initialStartIdx, initialEndIdx, trackWidth } = dragInfoRef.current;
    if (trackWidth <= 0 || totalPeriods <= 1) return;

    const deltaX = e.clientX - startX;
    const deltaIdx = Math.round((deltaX / trackWidth) * (totalPeriods - 1));

    if (dragging === 'single') {
      const nextIdx = Math.max(0, Math.min(totalPeriods - 1, initialStartIdx + deltaIdx));
      if (props.mode === 'single' && periods[nextIdx] !== props.selectedDate) {
        props.onSelectDate(periods[nextIdx]);
      }
    } else if (dragging === 'left') {
      const nextStart = Math.max(0, Math.min(initialEndIdx, initialStartIdx + deltaIdx));
      commitIndices(nextStart, initialEndIdx);
    } else if (dragging === 'right') {
      const nextEnd = Math.max(initialStartIdx, Math.min(totalPeriods - 1, initialEndIdx + deltaIdx));
      commitIndices(initialStartIdx, nextEnd);
    } else if (dragging === 'window') {
      const span = initialEndIdx - initialStartIdx;
      const nextStart = Math.max(0, Math.min(totalPeriods - 1 - span, initialStartIdx + deltaIdx));
      const nextEnd = nextStart + span;
      commitIndices(nextStart, nextEnd);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setDragging(null);
    }
  };

  // Direct track click
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    const clickedIdx = Math.max(0, Math.min(totalPeriods - 1, Math.round(clickRatio * (totalPeriods - 1))));

    if (props.mode === 'single') {
      if (periods[clickedIdx] !== props.selectedDate) {
        props.onSelectDate(periods[clickedIdx]);
      }
      dragInfoRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        initialStartIdx: clickedIdx,
        initialEndIdx: clickedIdx,
        trackWidth: rect.width,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      setDragging('single');
      return;
    }

    const distToStart = Math.abs(clickedIdx - startIdx);
    const distToEnd = Math.abs(clickedIdx - endIdx);

    if (distToStart < distToEnd) {
      commitIndices(clickedIdx, endIdx);
    } else {
      commitIndices(startIdx, clickedIdx);
    }
  };

  // Formatted date status strings
  const formattedSingle = isSingle ? formatPeriodLabel(fmt, periods[singleIdx]) : '';
  const formattedStart = !isSingle ? formatPeriodLabel(fmt, periods[startIdx]) : '';
  const formattedEnd = !isSingle ? formatPeriodLabel(fmt, periods[endIdx]) : '';

  return (
    <div className={cn('flex flex-col gap-1 w-full select-none', className)}>
      {/* Top Header: Year Presets & Active Date Range Status */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        {/* Preset Chips */}
        <div className="flex flex-wrap items-center gap-1">
          {isSingle ? (
            yearEntries.map(({ year, firstPeriod }, idx) => {
              const isLastYear = idx === yearEntries.length - 1;
              return (
                <PresetChip
                  key={year}
                  label={year}
                  isActive={singleYear === year}
                  onClick={() => {
                    const target = isLastYear ? periods[totalPeriods - 1] : firstPeriod;
                    props.onSelectDate(target);
                  }}
                />
              );
            })
          ) : (
            <>
              <PresetChip label={tCommon.all} isActive={activeYearPreset === 'all'} onClick={() => props.onChange({ dateFrom: '', dateTo: '' })} />
              {yearEntries.map(({ year, firstPeriod, lastPeriod }) => (
                <PresetChip
                  key={year}
                  label={year}
                  isActive={activeYearPreset === year}
                  onClick={() => {
                    props.onChange({
                      dateFrom: `${firstPeriod}-01`,
                      dateTo: `${lastPeriod}-${getLastDayOfMonth(lastPeriod)}`,
                    });
                  }}
                />
              ))}
            </>
          )}
        </div>

        {/* Status Badge: Active Period */}
        <div className="text-xs text-content-secondary font-medium flex items-center ml-auto">
          <span className="text-content-primary font-semibold">{isSingle ? formattedSingle : `${formattedStart} — ${formattedEnd}`}</span>
        </div>
      </div>

      {/* Scrubber Track Container */}
      <div className="flex flex-col gap-0.5 w-full">
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full h-8 rounded-lg bg-surface-base/90 border border-border-subtle/80 overflow-hidden cursor-pointer touch-none"
        >
          {/* Background Data Density Mini-Histogram (SVG) */}
          {densityBars.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
              {densityBars.map((bar) => {
                if (bar.heightPercent <= 0) return null;
                const isSelected = isSingle ? bar.centerPercent <= singlePercent : bar.centerPercent >= leftPercent && bar.centerPercent <= rightPercent;

                return (
                  <rect
                    key={bar.key}
                    x={`${bar.xPercent + 0.1}%`}
                    y={`${100 - bar.heightPercent}%`}
                    width={`${bar.widthPercent}%`}
                    height={`${bar.heightPercent}%`}
                    rx={1}
                    className={cn('transition-opacity', isSelected ? 'fill-accent-primary/50' : 'fill-content-muted/20')}
                  />
                );
              })}
            </svg>
          )}

          {isSingle ? (
            <>
              {/* Single Mode: Active Progress Fill */}
              <div style={{ width: `${singlePercent}%` }} className={cn(SELECTION_ZONE_BASE, 'left-0 border-r pointer-events-none', dragging === 'single' && SELECTION_ZONE_ACTIVE)} />

              {/* Single Mode: Draggable Thumb */}
              <ScrubberThumb
                percent={singlePercent}
                title={formattedSingle}
                isDragging={dragging === 'single'}
                onPointerDown={(e) => handlePointerDown('single', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </>
          ) : (
            <>
              {/* Range Mode: Active Selection Window (Brush Box with Middle Drag) */}
              <div
                onPointerDown={(e) => handlePointerDown('window', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                }}
                className={cn(SELECTION_ZONE_BASE, 'cursor-grab active:cursor-grabbing', dragging === 'window' && SELECTION_ZONE_ACTIVE)}
                title={`${formattedStart} — ${formattedEnd}`}
              >
                {/* Centered Grab Pill Indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 hover:opacity-90 transition-opacity">
                  <div className="w-5 h-1 rounded-full bg-accent-primary/80" />
                </div>
              </div>

              {/* Left Resize Handle (Thumb) */}
              <ScrubberThumb
                percent={leftPercent}
                title={formattedStart}
                isDragging={dragging === 'left'}
                onPointerDown={(e) => handlePointerDown('left', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />

              {/* Right Resize Handle (Thumb) */}
              <ScrubberThumb
                percent={rightPercent}
                title={formattedEnd}
                isDragging={dragging === 'right'}
                onPointerDown={(e) => handlePointerDown('right', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </>
          )}
        </div>

        {/* Year Tick Marks and Labels */}
        <div className="relative w-full h-5 px-0.5 mt-0.5">
          {yearEntries.map(({ year, firstIdx }) => {
            const yearLeftPercent = totalPeriods > 1 ? (firstIdx / (totalPeriods - 1)) * 100 : 0;
            return (
              <div key={year} style={{ left: `${yearLeftPercent}%` }} className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                <div className="w-px h-1.5 bg-border-active" />
                <span className="text-xs font-mono text-content-secondary font-semibold tracking-tight">{year}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
