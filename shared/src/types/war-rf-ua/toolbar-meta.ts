import type { WarLossesToolbarMeta, WarLossModelMeta } from './losses';

/** Project-level toolbar metadata for War RF-UA Frontline timeline scrubber. */
export interface WarFrontlineToolbarMeta {
  /** Earliest daily period identifier (e.g. '2022-02-23'). */
  minDate: string;
  /** Latest daily period identifier (e.g. '2026-10-16'). */
  maxDate: string;
  /** Sequential daily period identifiers spanning the full timeline. */
  periods: string[];
  /** Precomputed daily territorial shift intensity (km²) matching periods 1:1. */
  density: number[];
}

/** Unified project-level toolbar metadata container for War RF-UA dashboard. */
export interface WarRfUaToolbarMeta {
  frontline: WarFrontlineToolbarMeta;
  losses: WarLossesToolbarMeta;
}

export type { WarLossesFilterState } from './losses';
export type { WarStrikesFilterState } from './strikes';
export type { WarLossesToolbarMeta, WarLossModelMeta };

/** Reactive store state for the coordinated frontline toolbar. */
export type WarFrontlineFilterState = {
  period: [string, string];
};
