import { cloneDeep, isEqual } from 'lodash-es';
import queryString from 'query-string';
import type React from 'react';
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
          const strVal = String(rawVal);
          const options = typeof ctrl.options === 'function' ? ctrl.options({ ...defaultState, ...partial }) : ctrl.options;
          if (options.some((opt) => opt.value === strVal)) {
            partial[ctrl.id] = strVal;
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
          const validSet = new Set(items.map((it) => String(it.value)));
          const strVal = String(rawVal);
          if (validSet.size === 0 || validSet.has(strVal)) {
            partial[ctrl.id] = strVal;
          }
          break;
        }
        case 'multi-search-select': {
          const arr = Array.isArray(rawVal) ? rawVal : typeof rawVal === 'string' ? rawVal.split(',') : [rawVal];
          const items = typeof ctrl.items === 'function' ? ctrl.items({ ...defaultState, ...partial }) : ctrl.items;
          const validSet = new Set(items.map((it) => String(it.value)));
          partial[ctrl.id] = arr.map(String).filter((x) => validSet.size === 0 || validSet.has(x));
          break;
        }
        case 'timeline-scrubber': {
          const items = Array.isArray(rawVal) ? rawVal : typeof rawVal === 'string' ? rawVal.split(',') : [rawVal];
          const dates = items.map(String).filter((s) => s.length > 0);
          if (dates.length === 2 && ctrl.periods.length > 0) {
            const first = ctrl.periods[0];
            const last = ctrl.periods[ctrl.periods.length - 1];
            const d1 = dates[0] < first ? first : dates[0] > last ? last : dates[0];
            const d2 = dates[1] < first ? first : dates[1] > last ? last : dates[1];
            const low = d1 <= d2 ? d1 : d2;
            const high = d1 <= d2 ? d2 : d1;
            partial[ctrl.id] = [low, high];
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

  const initialValues = { ...cloneDeep(defaultState), ...readFromUrl() };
  let state: State = {
    ...initialValues,
    hasActiveFilters: checkHasActive(initialValues),
  };

  const listeners = new Set<() => void>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
    return () => {
      listeners.delete(listener);
    };
  }

  function useStore(): State {
    return useSyncExternalStore(subscribe, getState, getState);
  }

  return {
    getState,
    setState,
    resetState,
    subscribe,
    useStore,
  };
}

// Module-level registry maintaining referentially stable stores per scope ID across renders
const storeRegistry = new Map<string, ControlStore>();

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
    snapshots[key] = stores[key].getState();
  }
  return snapshots;
}

/**
 * React hook subscribing to a record of reactive control stores.
 * Returns a dictionary of current state snapshots indexed by store ID,
 * or undefined if no stores are provided.
 *
 * When an optional inViewRef and subscribeInView are provided, skips re-rendering
 * while off-screen and flushes pending updates when entering the viewport (isDirty pattern).
 */
export function useCombinedStores<TStores extends Record<string, ControlStore>>(
  stores?: TStores,
  inViewRef?: React.RefObject<boolean | null>,
  subscribeInView?: (listener: (inView: boolean) => void) => () => void,
): { [K in keyof TStores]: State } | undefined {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const isDirtyRef = useRef(false);

  // Subscribe to inView changes to flush pending updates when scrolling into view
  useEffect(() => {
    if (!subscribeInView) return;
    return subscribeInView((inView) => {
      if (inView && isDirtyRef.current) {
        isDirtyRef.current = false;
        startTransition(() => {
          forceUpdate();
        });
      }
    });
  }, [subscribeInView]);

  const storeKeys = stores ? Object.keys(stores).join('::') : '';

  // biome-ignore lint/correctness/useExhaustiveDependencies: subscriptions only rebind when store composition changes
  useEffect(() => {
    if (!stores) return;
    const storeList = Object.values(stores);
    if (storeList.length === 0) return;

    const handleStoreChange = () => {
      if (inViewRef && !inViewRef.current) {
        isDirtyRef.current = true;
        return;
      }
      startTransition(() => {
        forceUpdate();
      });
    };

    const unsubs = storeList.map((store) => store.subscribe(handleStoreChange));
    return () => {
      for (let i = 0; i < unsubs.length; i++) unsubs[i]();
    };
  }, [storeKeys]);

  if (!stores || Object.keys(stores).length === 0) return undefined;

  const result: Record<string, State> = {};
  for (const key in stores) {
    result[key] = stores[key].getState();
  }
  return result as { [K in keyof TStores]: State };
}
