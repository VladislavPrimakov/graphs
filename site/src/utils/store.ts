import { cloneDeep, isEqual } from 'lodash-es';
import queryString from 'query-string';
import { startTransition, useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import type { Control } from '@/utils/project';

/** Universal reactive filter state containing optional active filter indicator and dynamic control values. */
export interface State {
  [key: string]: unknown;
  hasActiveFilters?: boolean;
}

/** Reactive store contract powering interactive controls and toolbars. */
export interface ControlStore {
  /** React hook returning current reactive filter state. */
  useStore: () => State;
  /** Mutates filter state and dispatches notifications to all subscribers. */
  setState: (partial: Record<string, unknown> | ((prev: State) => Record<string, unknown>)) => void;
  /** Resets filter state back to defaults. */
  resetState: () => void;
  /** Synchronous state snapshot getter. */
  getState: () => State;
  /** Subscribes a listener callback to state changes. */
  subscribe: (listener: () => void) => () => void;
  /** Synchronously hydrates store state from URL query parameters on the client if not yet hydrated. */
  syncFromUrl: (options?: { silent?: boolean }) => void;
  /** Disposes active timers and clears subscriber listeners. */
  dispose?: () => void;
}

/** Configuration options for store creation. */
export interface StoreOptions {
  /** Debounce delay in milliseconds before synchronizing state to URL query string. @default 200 */
  debounceMs?: number;
  /** Prefix for URL query parameters. When undefined, controls are stored directly by their ID. */
  urlPrefix?: string;
}

/** Creates a reactive filter store synchronized with URL query parameters derived from controls. */
function createControlStore(controls?: readonly Control[] | Control[], options?: StoreOptions): ControlStore {
  const list = controls ?? [];
  const debounceMs = options?.debounceMs ?? 200;

  const defaultState: Record<string, unknown> = {};
  const getParamKey = (ctrl: Control): string => (options?.urlPrefix ? `${options.urlPrefix}.${ctrl.id}` : ctrl.id);

  for (const ctrl of list) {
    switch (ctrl.type) {
      case 'slider': {
        defaultState[ctrl.id] = ctrl.defaultValue;
        break;
      }
      case 'range-slider': {
        const min = typeof ctrl.min === 'function' ? ctrl.min({}) : ctrl.min;
        const max = typeof ctrl.max === 'function' ? ctrl.max({}) : ctrl.max;
        defaultState[ctrl.id] = ctrl.defaultValue ? [...ctrl.defaultValue] : [min, Math.max(min, max)];
        break;
      }
      case 'toggle': {
        defaultState[ctrl.id] = ctrl.defaultValue;
        break;
      }
      case 'checkbox': {
        defaultState[ctrl.id] = ctrl.defaultValue;
        break;
      }
      case 'single-search-select': {
        defaultState[ctrl.id] = ctrl.defaultValue ?? '';
        break;
      }
      case 'multi-search-select': {
        defaultState[ctrl.id] = ctrl.defaultValue ? [...ctrl.defaultValue] : [];
        break;
      }
      case 'timeline-scrubber': {
        defaultState[ctrl.id] = ctrl.defaultValue ? [...ctrl.defaultValue] : [ctrl.periods[0], ctrl.periods[ctrl.periods.length - 1]];
        break;
      }
    }
  }

  const managedKeys = list.map(getParamKey);
  const defaultKeys = Object.keys(defaultState);

  const checkHasActive = (current: Record<string, unknown>): boolean => defaultKeys.some((k) => !isEqual(current[k], defaultState[k]));

  const serialize = (current: State): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const ctrl of list) {
      const key = getParamKey(ctrl);
      const val = current[ctrl.id];
      const def = defaultState[ctrl.id];

      if (val !== undefined && !isEqual(val, def)) {
        out[key] = val;
      }
    }
    return out;
  };

  const parse = (rawQuery: Record<string, unknown>): Record<string, unknown> => {
    const partial: Record<string, unknown> = {};
    for (const ctrl of list) {
      const key = getParamKey(ctrl);
      const rawVal = rawQuery[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;

      switch (ctrl.type) {
        case 'slider': {
          const num = Number(rawVal);
          if (Number.isFinite(num)) {
            const contextState = { ...defaultState, ...partial };
            const min = typeof ctrl.min === 'function' ? ctrl.min(contextState) : ctrl.min;
            const max = typeof ctrl.max === 'function' ? ctrl.max(contextState) : ctrl.max;
            const effectiveMax = Math.max(min, max);
            partial[ctrl.id] = Math.max(min, Math.min(effectiveMax, num));
          }
          break;
        }
        case 'range-slider': {
          const items = Array.isArray(rawVal) ? rawVal : typeof rawVal === 'string' ? rawVal.split(',') : [rawVal];
          const nums = items.map(Number).filter(Number.isFinite);
          if (nums.length === 2) {
            const contextState = { ...defaultState, ...partial };
            const min = typeof ctrl.min === 'function' ? ctrl.min(contextState) : ctrl.min;
            const max = typeof ctrl.max === 'function' ? ctrl.max(contextState) : ctrl.max;
            const effectiveMax = Math.max(min, max);
            const low = Math.max(min, Math.min(effectiveMax, Math.min(nums[0], nums[1])));
            const high = Math.max(min, Math.min(effectiveMax, Math.max(nums[0], nums[1])));
            partial[ctrl.id] = [low, high];
          }
          break;
        }
        case 'toggle': {
          const strVal = String(rawVal).trim();
          const options = typeof ctrl.options === 'function' ? ctrl.options({ ...defaultState, ...partial }) : ctrl.options;
          const matched = options.find((opt) => opt.value.toLowerCase() === strVal.toLowerCase());
          if (matched) {
            partial[ctrl.id] = matched.value;
          }
          break;
        }
        case 'checkbox': {
          if (typeof rawVal === 'boolean') {
            partial[ctrl.id] = rawVal;
          } else if (rawVal === 'true' || rawVal === '1') {
            partial[ctrl.id] = true;
          } else if (rawVal === 'false' || rawVal === '0') {
            partial[ctrl.id] = false;
          }
          break;
        }
        case 'single-search-select': {
          const items = typeof ctrl.items === 'function' ? ctrl.items({ ...defaultState, ...partial }) : ctrl.items;
          const strVal = String(rawVal).trim();
          if (items.length === 0) {
            partial[ctrl.id] = strVal;
          } else {
            const matched = items.find((it) => String(it.value).toLowerCase() === strVal.toLowerCase());
            if (matched) {
              partial[ctrl.id] = matched.value;
            }
          }
          break;
        }
        case 'multi-search-select': {
          const arr = Array.isArray(rawVal) ? rawVal : typeof rawVal === 'string' ? rawVal.split(',') : [rawVal];
          const items = typeof ctrl.items === 'function' ? ctrl.items({ ...defaultState, ...partial }) : ctrl.items;
          if (items.length === 0) {
            partial[ctrl.id] = arr.map(String);
          } else {
            const itemMap = new Map<string, string | number>();
            for (const it of items) {
              itemMap.set(String(it.value).toLowerCase(), it.value);
            }
            const matchedValues: (string | number)[] = [];
            for (const x of arr) {
              const canonical = itemMap.get(String(x).trim().toLowerCase());
              if (canonical !== undefined) {
                matchedValues.push(canonical);
              }
            }
            partial[ctrl.id] = matchedValues;
          }
          break;
        }
        case 'timeline-scrubber': {
          const items = Array.isArray(rawVal) ? rawVal : typeof rawVal === 'string' ? rawVal.split(',') : [rawVal];
          const dates = items.map((s) => String(s).trim()).filter((s) => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(s));
          if (dates.length === 2 && ctrl.periods.length > 0) {
            const [rawLow, rawHigh] = dates[0] <= dates[1] ? [dates[0], dates[1]] : [dates[1], dates[0]];
            const lowIdx = ctrl.periods.findIndex((p) => p >= rawLow);
            const resolvedLowIdx = lowIdx === -1 ? ctrl.periods.length - 1 : lowIdx;
            const highIdx = ctrl.periods.findLastIndex((p) => p <= rawHigh || p.startsWith(rawHigh));
            const resolvedHighIdx = highIdx === -1 ? 0 : highIdx;
            partial[ctrl.id] = [ctrl.periods[resolvedLowIdx], ctrl.periods[Math.max(resolvedLowIdx, resolvedHighIdx)]];
          }
          break;
        }
      }
    }
    return partial;
  };

  function readFromUrl(): Record<string, unknown> {
    if (typeof window === 'undefined' || list.length === 0) return {};
    try {
      const parsed = queryString.parse(window.location.search, {
        arrayFormat: 'comma',
        parseNumbers: true,
        parseBooleans: true,
      });
      return parse(parsed);
    } catch {
      return {};
    }
  }

  let state: State = {
    ...cloneDeep(defaultState),
    hasActiveFilters: false,
  };

  const listeners = new Set<() => void>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasHydratedUrl = false;

  function syncFromUrl(options?: { silent?: boolean }): void {
    if (hasHydratedUrl || typeof window === 'undefined' || list.length === 0) return;
    hasHydratedUrl = true;
    const urlValues = readFromUrl();
    if (Object.keys(urlValues).length > 0) {
      if (options?.silent) {
        const nextState: State = {
          ...state,
          ...urlValues,
        };
        nextState.hasActiveFilters = checkHasActive(nextState);
        state = Object.freeze(nextState);
      } else {
        setState(urlValues);
      }
    }
  }

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function syncToUrl(): void {
    if (typeof window === 'undefined' || list.length === 0) return;
    try {
      const currentAll = queryString.parse(window.location.search, {
        arrayFormat: 'comma',
      });

      for (const key of managedKeys) {
        delete currentAll[key];
      }

      const activeParams = serialize(state);
      const merged = { ...currentAll, ...activeParams };

      const newQuery = queryString.stringify(merged, {
        arrayFormat: 'comma',
      });
      const targetSearch = newQuery ? `?${newQuery}` : '';

      if (window.location.search !== targetSearch) {
        const targetUrl = `${window.location.pathname}${targetSearch}${window.location.hash}`;
        window.history.replaceState(null, '', targetUrl);
      }
    } catch {
      // Fallback silently in restricted browsing contexts
    }
  }

  function scheduleUrlSync(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      syncToUrl();
    }, debounceMs);
  }

  function getState(): State {
    return state;
  }

  function setState(partial: Record<string, unknown> | ((prev: State) => Record<string, unknown>)): void {
    const nextPartial = typeof partial === 'function' ? partial(state) : partial;
    const hasChanges = Object.keys(nextPartial).some((key) => !isEqual(state[key], nextPartial[key]));
    if (!hasChanges) return;

    const nextState: State = {
      ...state,
      ...nextPartial,
    };
    nextState.hasActiveFilters = checkHasActive(nextState);

    state = nextState;
    notify();
    scheduleUrlSync();
  }

  function resetState(): void {
    if (!state.hasActiveFilters) return;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    state = {
      ...cloneDeep(defaultState),
      hasActiveFilters: false,
    };
    notify();
    syncToUrl();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    if (!hasHydratedUrl && typeof window !== 'undefined') {
      queueMicrotask(() => {
        syncFromUrl();
      });
    }

    return () => {
      listeners.delete(listener);
    };
  }

  function useStore(): State {
    return useSyncExternalStore(subscribe, getState, getState);
  }

  function dispose(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    listeners.clear();
  }

  return {
    getState,
    setState,
    resetState,
    subscribe,
    syncFromUrl,
    useStore,
    dispose,
  };
}

// Module-level registry maintaining referentially stable stores per scope ID across renders
const storeRegistry = new Map<string, ControlStore>();

/** Clears all cached stores in the registry and disposes their active timers. */
export function clearStoreRegistry(): void {
  for (const store of storeRegistry.values()) {
    store.dispose?.();
  }
  storeRegistry.clear();
}

/** Retrieves an existing store instance or instantiates and caches a new store derived from controls. */
export function getOrCreateStoreFromControls(scopeId: string, controls?: readonly Control[] | Control[], options?: StoreOptions): ControlStore {
  const existing = storeRegistry.get(scopeId);
  if (existing) {
    return existing;
  }
  const store = createControlStore(controls, options);
  storeRegistry.set(scopeId, store);
  return store;
}

/**
 * Extracts a static dictionary of current state snapshots indexed by store ID from a record of reactive control stores.
 * Omit parameters or pass undefined to receive an empty dictionary.
 */
export function getStoreSnapshots(stores?: Record<string, ControlStore>): Record<string, State> {
  if (!stores) return {};
  const snapshots: Record<string, State> = {};
  for (const key in stores) {
    stores[key].syncFromUrl({ silent: true });
    snapshots[key] = stores[key].getState();
  }
  return snapshots;
}

/**
 * React hook subscribing to a record of reactive control stores.
 * Returns a dictionary of current state snapshots indexed by store ID,
 * or undefined if no stores are provided.
 *
 * When an optional deferUntilInView dispatcher is provided, defers re-rendering
 * while off-screen and flushes pending updates when entering the viewport.
 */
export function useCombinedStores<TStores extends Record<string, ControlStore>>(stores?: TStores, deferUntilInView?: (action: () => void) => void): { [K in keyof TStores]: State } | undefined {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const stableTrigger = useRef(() => {
    startTransition(() => {
      forceUpdate();
    });
  }).current;

  const storeKeys = stores ? Object.keys(stores).join('::') : '';

  // biome-ignore lint/correctness/useExhaustiveDependencies: subscriptions only rebind when store composition changes
  useEffect(() => {
    if (!stores) return;
    const storeList = Object.values(stores);
    if (storeList.length === 0) return;

    const handleStoreChange = () => {
      if (deferUntilInView) {
        deferUntilInView(stableTrigger);
      } else {
        stableTrigger();
      }
    };

    const unsubs = storeList.map((store) => store.subscribe(handleStoreChange));
    return () => {
      for (let i = 0; i < unsubs.length; i++) unsubs[i]();
    };
  }, [storeKeys, deferUntilInView, stableTrigger]);

  if (!stores || Object.keys(stores).length === 0) return undefined;

  const result: Record<string, State> = {};
  for (const key in stores) {
    result[key] = stores[key].getState();
  }
  return result as { [K in keyof TStores]: State };
}
