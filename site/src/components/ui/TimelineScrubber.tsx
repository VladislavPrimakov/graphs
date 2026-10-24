import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { useFormat, useTranslation } from '@/utils/provider';
import { DatePickerPopover } from './DatePickerPopover';

export type ScrubberGranularity = 'daily' | 'monthly' | 'yearly';

/** Props for the interactive TimelineScrubber component. */
export interface TimelineScrubberProps {
  /** Temporal resolution: 'daily', 'monthly', or 'yearly'. */
  granularity: ScrubberGranularity;
  /** Sequential period identifiers spanning the full timeline (e.g. yearly `['1990', ...]`, monthly `['2022-02', ...]`, daily `['2023-01-28', ...]`). */
  periods: string[];
  /** Numeric event counts for the background density histogram matching `periods` 1:1. */
  density?: number[];
  /** Currently active start date (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`), or empty string for all time. */
  dateFrom: string;
  /** Currently active end date (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`), or empty string for all time. */
  dateTo: string;
  /** Callback fired when the selection window or preset changes. */
  onChange: (range: { dateFrom: string; dateTo: string }) => void;
  /** Optional callback resetting state back to default. */
  onReset?: () => void;
  /** Indicates whether non-default filters are active. */
  hasActiveFilters?: boolean;
  /** Additional container CSS class names. */
  className?: string;
}

/** Formats a `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` period into a localized label. */
function formatPeriodLabel(fmt: ReturnType<typeof useFormat>, period: string, granularity: ScrubberGranularity): string {
  if (!period) return '';
  const parts = period.split('-').map(Number);
  if (granularity === 'yearly') {
    return fmt.date(new Date(parts[0], 0, 1), { year: 'numeric' });
  }
  if (granularity === 'monthly') {
    return fmt.date(new Date(parts[0], parts[1] - 1, 1), { month: 'short', year: 'numeric' });
  }
  return fmt.date(new Date(parts[0], parts[1] - 1, parts[2]), { day: 'numeric', month: 'short', year: 'numeric' });
}

const labelLengthCache = new WeakMap<ReturnType<typeof useFormat>, Map<ScrubberGranularity, number>>();

/** Dynamically computes the maximum formatted date string length across all calendar units for the active locale. */
function getMaxPeriodLabelChars(fmt: ReturnType<typeof useFormat>, granularity: ScrubberGranularity): number {
  let cache = labelLengthCache.get(fmt);
  if (!cache) {
    cache = new Map();
    labelLengthCache.set(fmt, cache);
  }
  const cached = cache.get(granularity);
  if (cached !== undefined) return cached;

  let maxLen = 0;
  if (granularity === 'yearly') {
    maxLen = 4;
  } else {
    for (let m = 0; m < 12; m++) {
      const d = granularity === 'monthly' ? new Date(2024, m, 1) : new Date(2024, m, 28);
      const label = granularity === 'monthly' ? fmt.date(d, { month: 'short', year: 'numeric' }) : fmt.date(d, { day: 'numeric', month: 'short', year: 'numeric' });
      if (label.length > maxLen) {
        maxLen = label.length;
      }
    }
  }

  cache.set(granularity, maxLen);
  return maxLen;
}

/** Resolves index of a date string in sequential periods supporting exact, prefix, or boundary clamping. */
function findPeriodIndex(periods: string[], date: string, type: 'start' | 'end', granularity: ScrubberGranularity): number {
  if (!date || periods.length === 0) return type === 'start' ? 0 : periods.length - 1;

  const directIdx = periods.indexOf(date);
  if (directIdx !== -1) return directIdx;

  let target = date;
  if (granularity === 'yearly') {
    target = date.slice(0, 4);
  } else if (granularity === 'monthly') {
    target = date.length > 7 ? date.slice(0, 7) : date;
  }

  const targetIdx = periods.indexOf(target);
  if (targetIdx !== -1) return targetIdx;

  if (type === 'start') {
    const idx = periods.findIndex((p) => p >= target);
    return idx === -1 ? periods.length - 1 : idx;
  }
  const idx = periods.findLastIndex((p) => p <= target || p.startsWith(target));
  return idx === -1 ? 0 : idx;
}

interface PeriodPresetEntry {
  id: string;
  label: string;
  firstIdx: number;
  lastIdx: number;
  firstPeriod: string;
  lastPeriod: string;
}

const presetsCache = new WeakMap<ReturnType<typeof useFormat>, WeakMap<string[], PeriodPresetEntry[]>>();

/** Precomputes preset boundary chunks (years or decades for long yearly mode), cached per periods array. */
function getPeriodPresets(periods: string[], granularity: ScrubberGranularity, fmt: ReturnType<typeof useFormat>): PeriodPresetEntry[] {
  let fmtCache = presetsCache.get(fmt);
  if (!fmtCache) {
    fmtCache = new WeakMap();
    presetsCache.set(fmt, fmtCache);
  }
  let entries = fmtCache.get(periods);
  if (entries) return entries;

  entries = [];
  const map = new Map<string, PeriodPresetEntry>();
  const isDecades = granularity === 'yearly' && periods.length > 10;

  for (let i = 0; i < periods.length; i++) {
    const key = isDecades ? `${periods[i].slice(0, 3)}0` : periods[i].slice(0, 4);
    const existing = map.get(key);
    if (!existing) {
      const label = isDecades ? fmt.decade(`${key}s`) : key;
      const entry: PeriodPresetEntry = { id: key, label, firstIdx: i, lastIdx: i, firstPeriod: periods[i], lastPeriod: periods[i] };
      map.set(key, entry);
      entries.push(entry);
    } else {
      existing.lastIdx = i;
      existing.lastPeriod = periods[i];
    }
  }

  fmtCache.set(periods, entries);
  return entries;
}

interface TrackMarker {
  key: string;
  label: string;
  firstIdx: number;
}

const trackMarkersCache = new WeakMap<string[], TrackMarker[]>();

/** Precomputes demarcation track markers, cached per periods array. */
function getTrackMarkers(periods: string[], granularity: ScrubberGranularity): TrackMarker[] {
  let markers = trackMarkersCache.get(periods);
  if (markers) return markers;

  markers = [];
  const isDecades = granularity === 'yearly' && periods.length > 15;
  const seen = new Set<string>();

  for (let i = 0; i < periods.length; i++) {
    const label = isDecades ? `${periods[i].slice(0, 3)}0` : periods[i].slice(0, 4);
    if (!seen.has(label)) {
      seen.add(label);
      markers.push({ key: label, label, firstIdx: i });
    }
  }

  trackMarkersCache.set(periods, markers);
  return markers;
}

interface DensityBar {
  key: string;
  xPercent: number;
  widthPercent: number;
  heightPercent: number;
  centerPercent: number;
}

const densityBarsCache = new WeakMap<string[], DensityBar[]>();

/** Normalizes and samples density bars down to max 100 bars, cached per periods array. */
function getDensityBars(periods: string[], density?: number[]): DensityBar[] {
  if (!density || density.length === 0) return [];
  let bars = densityBarsCache.get(periods);
  if (bars) return bars;

  const n = density.length;
  if (n <= 100) {
    const maxVal = Math.max(...density, 0.001);
    const barWidth = Math.max(0.4, 100 / n - 0.25);
    bars = density.map((val, idx) => ({
      key: periods[idx] || String(idx),
      xPercent: (idx / n) * 100,
      widthPercent: barWidth,
      heightPercent: val > 0 ? Math.max(4, (val / maxVal) * 85) : 0,
      centerPercent: ((idx + 0.5) / n) * 100,
    }));
  } else {
    const bins = 100;
    const binSize = n / bins;
    const barWidth = 100 / bins - 0.25;
    const binValues: number[] = [];

    for (let b = 0; b < bins; b++) {
      const start = Math.floor(b * binSize);
      const end = Math.floor((b + 1) * binSize);
      let sum = 0;
      for (let i = start; i < end; i++) sum += density[i] || 0;
      binValues.push(sum);
    }

    const maxBarVal = Math.max(...binValues, 0.001);
    bars = binValues.map((val, b) => ({
      key: `bin-${b}`,
      xPercent: (b / bins) * 100,
      widthPercent: barWidth,
      heightPercent: val > 0 ? Math.max(4, (val / maxBarVal) * 85) : 0,
      centerPercent: ((b + 0.5) / bins) * 100,
    }));
  }

  densityBarsCache.set(periods, bars);
  return bars;
}

/** Unified draggable handle with pointer capture and glowing active ring. */
function ScrubberThumb({
  percent,
  title,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  percent: number;
  title: string;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: `${percent}%` }}
      className="absolute top-0 bottom-0 -ml-2 w-4 flex items-center justify-center cursor-ew-resize group z-20 touch-none"
      title={title}
    >
      <div
        className={cn(
          'w-1.5 h-3.5 rounded-xs bg-accent-primary border border-white/20 dark:border-surface-base/30 shadow-xs flex items-center justify-center transition-transform',
          'group-hover:scale-110 group-hover:bg-accent-hover',
          isDragging && 'scale-115 ring-2 ring-accent-primary/40',
        )}
      >
        <div className="w-0.5 h-2 bg-white/70 dark:bg-surface-base/80 rounded-full" />
      </div>
    </div>
  );
}

const SELECTION_ZONE_BASE = 'absolute top-0 bottom-0 bg-accent-primary/20 border-y border-accent-primary/40 pointer-events-none transition-colors';

/**
 * Interactive timeline scrubber control featuring:
 * - Dual-thumb interval resizing with nearest-thumb track clicks
 * - Year and decade preset chips and quick-jump navigation
 * - Lightweight SVG data density mini-histogram
 * - Segmented date picker popovers supporting daily, monthly, and yearly granularities
 */
export function TimelineScrubber({ granularity, periods, density, dateFrom, dateTo, onChange, onReset, hasActiveFilters, className }: TimelineScrubberProps) {
  const {
    t: { common: tCommon },
  } = useTranslation();
  const fmt = useFormat();

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);

  const dragInfoRef = useRef<{
    pointerId: number;
    startX: number;
    initialStartIdx: number;
    initialEndIdx: number;
    trackWidth: number;
  }>({ pointerId: 0, startX: 0, initialStartIdx: 0, initialEndIdx: 0, trackWidth: 0 });

  const lastCommittedRef = useRef<[number, number]>([0, 0]);
  const pendingCommitRef = useRef<[number, number] | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const totalPeriods = periods.length;
  if (totalPeriods === 0) return null;

  const startIdx = Math.min(dateFrom ? findPeriodIndex(periods, dateFrom, 'start', granularity) : 0, totalPeriods - 1);
  const rawEndIdx = dateTo ? findPeriodIndex(periods, dateTo, 'end', granularity) : totalPeriods - 1;
  const endIdx = Math.max(startIdx, rawEndIdx);

  const effectiveStartIdx = dragRange ? dragRange[0] : startIdx;
  const effectiveEndIdx = dragRange ? dragRange[1] : endIdx;

  if (!dragging) {
    lastCommittedRef.current = [startIdx, endIdx];
  }

  const presets = getPeriodPresets(periods, granularity, fmt);
  const trackMarkers = getTrackMarkers(periods, granularity);
  const densityBars = getDensityBars(periods, density);

  const isAllTime = effectiveStartIdx === 0 && effectiveEndIdx === totalPeriods - 1;
  let activePreset: string | null = isAllTime ? 'all' : null;

  if (!isAllTime) {
    for (const entry of presets) {
      if (effectiveStartIdx === entry.firstIdx && effectiveEndIdx === entry.lastIdx) {
        activePreset = entry.id;
        break;
      }
    }
  }

  const leftPercent = totalPeriods > 1 ? (effectiveStartIdx / (totalPeriods - 1)) * 100 : 0;
  const rightPercent = totalPeriods > 1 ? (effectiveEndIdx / (totalPeriods - 1)) * 100 : 100;
  const widthPercent = Math.max(0, rightPercent - leftPercent);

  const commitIndices = (nextStart: number, nextEnd: number) => {
    if (lastCommittedRef.current[0] === nextStart && lastCommittedRef.current[1] === nextEnd) return;
    lastCommittedRef.current = [nextStart, nextEnd];
    onChange({ dateFrom: periods[nextStart], dateTo: periods[nextEnd] });
  };

  const scheduleCommit = (nextStart: number, nextEnd: number) => {
    pendingCommitRef.current = [nextStart, nextEnd];
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingCommitRef.current) {
          const [s, e] = pendingCommitRef.current;
          pendingCommitRef.current = null;
          commitIndices(s, e);
        }
      });
    }
  };

  const applyRangePreset = (first: string, last: string) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingCommitRef.current = null;
    setDragRange(null);
    setDragging(null);
    const newStart = findPeriodIndex(periods, first, 'start', granularity);
    const newEnd = findPeriodIndex(periods, last, 'end', granularity);
    commitIndices(newStart, newEnd);
  };

  const handlePointerDown = (type: 'left' | 'right', e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = trackRef.current.getBoundingClientRect();
    dragInfoRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      initialStartIdx: effectiveStartIdx,
      initialEndIdx: effectiveEndIdx,
      trackWidth: rect.width,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDragging(type);
    setDragRange([effectiveStartIdx, effectiveEndIdx]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !trackRef.current) return;
    e.stopPropagation();
    const { startX, initialStartIdx, initialEndIdx, trackWidth } = dragInfoRef.current;
    if (trackWidth <= 0 || totalPeriods <= 1) return;

    const deltaX = e.clientX - startX;
    const deltaIdx = Math.round((deltaX / trackWidth) * (totalPeriods - 1));

    const nextStart = dragging === 'left' ? Math.max(0, Math.min(initialEndIdx, initialStartIdx + deltaIdx)) : initialStartIdx;
    const nextEnd = dragging === 'right' ? Math.max(initialStartIdx, Math.min(totalPeriods - 1, initialEndIdx + deltaIdx)) : initialEndIdx;

    setDragRange([nextStart, nextEnd]);
    scheduleCommit(nextStart, nextEnd);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (pendingCommitRef.current) {
        const [s, e] = pendingCommitRef.current;
        pendingCommitRef.current = null;
        commitIndices(s, e);
      } else if (dragRange) {
        commitIndices(dragRange[0], dragRange[1]);
      }

      setDragRange(null);
      setDragging(null);
    }
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    const clickedIdx = Math.max(0, Math.min(totalPeriods - 1, Math.round(clickRatio * (totalPeriods - 1))));

    const distToStart = Math.abs(clickedIdx - effectiveStartIdx);
    const distToEnd = Math.abs(clickedIdx - effectiveEndIdx);
    const targetThumb: 'left' | 'right' = distToStart < distToEnd ? 'left' : 'right';

    const nextStart = targetThumb === 'left' ? clickedIdx : effectiveStartIdx;
    const nextEnd = targetThumb === 'right' ? clickedIdx : effectiveEndIdx;

    setDragRange([nextStart, nextEnd]);
    scheduleCommit(nextStart, nextEnd);

    dragInfoRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      initialStartIdx: nextStart,
      initialEndIdx: nextEnd,
      trackWidth: rect.width,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDragging(targetThumb);
  };

  const maxDateChars = getMaxPeriodLabelChars(fmt, granularity);
  const formattedStart = formatPeriodLabel(fmt, periods[effectiveStartIdx], granularity);
  const formattedEnd = formatPeriodLabel(fmt, periods[effectiveEndIdx], granularity);

  return (
    <div className={cn('flex flex-col gap-1.5 w-full select-none', className)}>
      {/* Top Header: Presets & Active Date Range Status */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => applyRangePreset(periods[0], periods[totalPeriods - 1])}
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
              activePreset === 'all' ? 'btn-accent font-semibold shadow-xs' : 'btn-subtle text-content-muted hover:text-content-primary',
            )}
          >
            {tCommon.all}
          </button>
          {presets.map(({ id, label, firstPeriod, lastPeriod }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyRangePreset(firstPeriod, lastPeriod)}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
                activePreset === id ? 'btn-accent font-semibold shadow-xs' : 'btn-subtle text-content-muted hover:text-content-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="text-xs text-content-secondary font-medium flex items-center gap-1.5 ml-auto">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                'text-xs text-content-muted hover:text-accent-primary transition-opacity underline cursor-pointer select-none whitespace-nowrap mr-1',
                !hasActiveFilters && 'invisible pointer-events-none',
              )}
            >
              {tCommon.reset}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <DatePickerPopover
              mode={granularity}
              value={periods[effectiveStartIdx]}
              minDate={periods[0]}
              maxDate={periods[effectiveEndIdx]}
              label={formattedStart}
              minChars={maxDateChars}
              onSelect={(dateStr) => {
                const newIdx = findPeriodIndex(periods, dateStr, 'start', granularity);
                commitIndices(Math.min(newIdx, effectiveEndIdx), effectiveEndIdx);
              }}
              onStepPrev={(e) => {
                const step = e.shiftKey ? (granularity === 'yearly' ? 10 : granularity === 'monthly' ? 12 : 7) : 1;
                commitIndices(Math.max(0, effectiveStartIdx - step), effectiveEndIdx);
              }}
              canStepPrev={effectiveStartIdx > 0}
              onStepNext={(e) => {
                const step = e.shiftKey ? (granularity === 'yearly' ? 10 : granularity === 'monthly' ? 12 : 7) : 1;
                commitIndices(Math.min(effectiveEndIdx, effectiveStartIdx + step), effectiveEndIdx);
              }}
              canStepNext={effectiveStartIdx < effectiveEndIdx}
              title={tCommon.from}
            />

            <DatePickerPopover
              mode={granularity}
              value={periods[effectiveEndIdx]}
              minDate={periods[effectiveStartIdx]}
              maxDate={periods[totalPeriods - 1]}
              label={formattedEnd}
              minChars={maxDateChars}
              onSelect={(dateStr) => {
                const newIdx = findPeriodIndex(periods, dateStr, 'end', granularity);
                commitIndices(effectiveStartIdx, Math.max(effectiveStartIdx, newIdx));
              }}
              onStepPrev={(e) => {
                const step = e.shiftKey ? (granularity === 'yearly' ? 10 : granularity === 'monthly' ? 12 : 7) : 1;
                commitIndices(effectiveStartIdx, Math.max(effectiveStartIdx, effectiveEndIdx - step));
              }}
              canStepPrev={effectiveEndIdx > effectiveStartIdx}
              onStepNext={(e) => {
                const step = e.shiftKey ? (granularity === 'yearly' ? 10 : granularity === 'monthly' ? 12 : 7) : 1;
                commitIndices(effectiveStartIdx, Math.min(totalPeriods - 1, effectiveEndIdx + step));
              }}
              canStepNext={effectiveEndIdx < totalPeriods - 1}
              title={tCommon.to}
            />
          </div>
        </div>
      </div>

      {/* Scrubber Track Container */}
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-5 rounded-md bg-surface-base/90 border border-border-subtle/80 overflow-hidden cursor-pointer touch-none"
      >
        {/* Background Layer: Histogram & In-Track Labels */}
        <div className="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
          {densityBars.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
              {densityBars.map((bar) => {
                if (bar.heightPercent <= 0) return null;
                const isSelected = bar.centerPercent >= leftPercent && bar.centerPercent <= rightPercent;
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

          {/* In-Track Demarcation Labels */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            {trackMarkers.map(({ key, label, firstIdx }) => {
              const markerLeftPercent = totalPeriods > 1 ? (firstIdx / (totalPeriods - 1)) * 100 : 0;
              return (
                <div key={key} style={{ left: `${markerLeftPercent}%` }} className="absolute top-0 bottom-0 flex items-center pl-1.5 border-l border-border-subtle/80 pointer-events-none">
                  <span className="text-3xs font-mono font-bold text-content-secondary select-none tracking-wider">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Selection Zone (Visual range fill) */}
        <div style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }} className={SELECTION_ZONE_BASE} />

        {/* Left Resize Handle */}
        <ScrubberThumb
          percent={leftPercent}
          title={formattedStart}
          isDragging={dragging === 'left'}
          onPointerDown={(e) => handlePointerDown('left', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Right Resize Handle */}
        <ScrubberThumb
          percent={rightPercent}
          title={formattedEnd}
          isDragging={dragging === 'right'}
          onPointerDown={(e) => handlePointerDown('right', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  );
}
