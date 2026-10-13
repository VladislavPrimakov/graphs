import type { WarLossCategory } from '@graphs/types/war-rf-ua/categories';
import type { LossMapPoint } from '@graphs/types/war-rf-ua/losses-map';
import { useSyncExternalStore } from 'react';

/** Map dataset cache structure shared with downstream breakdown visualizers. */
export interface LossesMapSharedData {
  points: LossMapPoint[];
  categories: WarLossCategory[];
  models: string[];
  sides: ['RF', 'UA', 'UNK'];
}

/** Reactive state for coordinated military equipment loss filters. */
export interface LossesFilterState {
  selectedSide: 'all' | 'rf' | 'ua' | 'unk';
  selectedCategories: number[];
  selectedModels: number[];
  dateFrom: string;
  dateTo: string;
  mapData?: LossesMapSharedData;
}

const defaultState: LossesFilterState = {
  selectedSide: 'all',
  selectedCategories: [],
  selectedModels: [],
  dateFrom: '',
  dateTo: '',
};

let currentState: LossesFilterState = { ...defaultState };
const listeners = new Set<() => void>();

/** Returns current snapshot of losses filters synchronously. */
export function getLossesFilterState(): LossesFilterState {
  return currentState;
}

/** Updates filter state and dispatches notifications to all subscribers. */
export function setLossesFilterState(partial: Partial<LossesFilterState>): void {
  currentState = { ...currentState, ...partial };
  for (const listener of listeners) {
    listener();
  }
}

/** Resets all active filter dimensions back to full dataset overview while preserving loaded map data. */
export function resetLossesFilters(): void {
  currentState = {
    ...currentState,
    selectedSide: 'all',
    selectedCategories: [],
    selectedModels: [],
    dateFrom: '',
    dateTo: '',
  };
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes a listener callback to losses filter mutations. */
export function subscribeLossesFilters(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook subscribing to coordinated losses filters via useSyncExternalStore. */
export function useLossesFilters(): LossesFilterState & { hasActiveFilters: boolean } {
  const state = useSyncExternalStore(subscribeLossesFilters, getLossesFilterState, getLossesFilterState);
  const hasActiveFilters = state.selectedSide !== 'all' || state.selectedCategories.length > 0 || state.selectedModels.length > 0 || Boolean(state.dateFrom) || Boolean(state.dateTo);

  return {
    ...state,
    hasActiveFilters,
  };
}
