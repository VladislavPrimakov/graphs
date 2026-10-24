import type React from 'react';
import type { ResolvedTheme, ThemeColors } from '@/styles/tokens';
import type { SemanticColor } from '@/utils/color';
import type { LocalizedFormatters } from '@/utils/format';
import type { Language, LocaleCommonDict } from '@/utils/provider';
import type { State } from '@/utils/store';

/* -------------------------------------------------------------------------- */
/* 1. Project Categorization Tags                                             */
/* -------------------------------------------------------------------------- */

/** Canonical registry of all categorization and discovery tags used across projects. */
export const PROJECT_TAGS = [
  'global',
  'space',
  'launches',
  'ua',
  'rf',
  'war',
  'frontline',
  'air-defense',
  'missiles',
  'uav',
  'losses',
  'equipment',
  'economy',
  'budget',
  'gdp',
  'energy',
  'industry',
  'ai',
  'tokens',
  'compute',
] as const;

/** Union type of all valid project categorization tags. */
export type ProjectTag = (typeof PROJECT_TAGS)[number];

/* -------------------------------------------------------------------------- */
/* 2. Interactive Chart & Toolbar Controls                                    */
/* -------------------------------------------------------------------------- */

/** Option item representation for SearchSelect dropdown. */
export interface ControlSearchItem {
  value: string | number;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

/** Shared base properties across all interactive controls. */
export interface BaseControl {
  id: string;
  label?: string;
  disabled?: boolean | ((state: State) => boolean);
  /** Debounce delay in milliseconds before dispatching state changes to the store. If omitted or 0, updates fire immediately. @default 0 */
  debounceMs?: number;
  /** Optional custom state mutation dispatched on value change. When omitted, dispatches `{ [id]: value }`. */
  onChange?: (value: unknown, state: State) => Record<string, unknown>;
}

/** Canonical mapping between control types and their emitted primitive value types. */
interface ControlValueMap {
  slider: number;
  'range-slider': [number, number];
  checkbox: boolean;
  'single-search-select': string;
  'multi-search-select': string[];
  toggle: string;
  'timeline-scrubber': [string, string];
}

export interface SliderControl extends BaseControl {
  type: 'slider';
  min: number | ((state: State) => number);
  max: number | ((state: State) => number);
  step?: number;
  defaultValue: number;
}

export interface RangeSliderControl extends BaseControl {
  type: 'range-slider';
  min: number | ((state: State) => number);
  max: number | ((state: State) => number);
  step?: number;
  minStepsBetweenThumbs?: number;
  defaultValue?: readonly [number, number] | [number, number];
}

export interface CheckboxControl extends BaseControl {
  type: 'checkbox';
  defaultValue: boolean;
}

export interface SingleSearchSelectControl extends BaseControl {
  type: 'single-search-select';
  placeholder?: string | ((state: Record<string, unknown>) => string);
  emptyLabel?: string;
  items: readonly ControlSearchItem[] | ControlSearchItem[] | ((state: Record<string, unknown>) => readonly ControlSearchItem[] | ControlSearchItem[]);
  defaultValue?: string;
}

export interface MultiSearchSelectControl extends BaseControl {
  type: 'multi-search-select';
  placeholder?: string | ((state: Record<string, unknown>) => string);
  emptyLabel?: string;
  allLabel?: string;
  allCount?: number | ((state: Record<string, unknown>) => number | undefined);
  items: readonly ControlSearchItem[] | ControlSearchItem[] | ((state: Record<string, unknown>) => readonly ControlSearchItem[] | ControlSearchItem[]);
  defaultValue?: readonly string[] | string[];
}

export interface ToggleOption {
  readonly value: string;
  readonly label: React.ReactNode;
}

export interface ToggleControl extends BaseControl {
  type: 'toggle';
  options: readonly ToggleOption[] | ((state: Record<string, unknown>) => readonly ToggleOption[]);
  defaultValue: string;
}

/** Supported temporal resolutions for the timeline scrubber control. */
export type ScrubberGranularity = 'daily' | 'monthly' | 'yearly';

export interface TimelineScrubberControl extends BaseControl {
  type: 'timeline-scrubber';
  /** Temporal resolution of the timeline periods: 'daily', 'monthly', or 'yearly'. */
  granularity: ScrubberGranularity;
  periods: readonly string[] | string[];
  density?: readonly number[] | number[];
  defaultValue?: readonly [string, string] | [string, string];
}

/** Discriminated union of all supported interactive chart & toolbar controls. */
export type Control = SliderControl | RangeSliderControl | CheckboxControl | SingleSearchSelectControl | MultiSearchSelectControl | ToggleControl | TimelineScrubberControl;

/**
 * Resolves the strongly-typed value emitted by a single control specification.
 * Infers literal union types for `toggle` options and maps primitive types for sliders, checkboxes, and search selectors.
 *
 * @example
 * // Slider resolves to number:
 * type S = ControlValue<{ type: 'slider'; id: 'top' }>; // number
 *
 * // Toggle with options resolves to literal union:
 * type T = ControlValue<{ type: 'toggle'; id: 'mode'; options: [{ value: 'abs' }, { value: 'pct' }] }>; // 'abs' | 'pct'
 */
export type ControlValue<C> = C extends {
  readonly options: readonly { readonly value: infer V }[];
}
  ? V
  : C extends { readonly type: keyof ControlValueMap }
    ? ControlValueMap[C['type']]
    : unknown;

/**
 * Derives a strongly-typed reactive state object `{ [id]: value }` from an array of controls.
 * Automatically provides compile-time type safety and IDE autocomplete in `buildView(data, controls)`.
 *
 * @example
 * const controls = [
 *   { id: 'years', type: 'range-slider', min: 2000, max: 2024 },
 *   { id: 'labels', type: 'checkbox', defaultValue: true },
 *   { id: 'mode', type: 'toggle', defaultValue: 'abs', options: [{ value: 'abs' }, { value: 'pct' }] as const }
 * ] as const;
 *
 * type Values = ControlsToValues<typeof controls>;
 * // => { years: [number, number]; labels: boolean; mode: 'abs' | 'pct' }
 */
export type ControlsToValues<C extends readonly Control[] | undefined = readonly Control[] | undefined> = C extends readonly Control[]
  ? {
      [K in C[number] as K['id']]: ControlValue<K>;
    }
  : State;

/** Interactive toolbar specification containing unique ID and an array of controls. */
export interface ToolbarSpec<Id extends string = string, C extends readonly Control[] = readonly Control[]> {
  /** Unique toolbar identifier used as key in reactive stores object. */
  id: Id;
  /**
   * Prefix for URL query parameters.
   * If omitted, controls are stored without a namespace prefix (e.g. `?country=cn`).
   * When specified, controls are namespaced as `${urlPrefix}.${controlId}` (e.g. `?frontline.period=...`).
   */
  urlPrefix?: string;
  /** Interactive control specifications rendered in the toolbar. */
  controls: C;
}

/** Sticky dashboard toolbar specification scoping controls to specific sections. */
export interface DashboardToolbarSpec<Id extends string = string, C extends readonly Control[] = readonly Control[]> extends ToolbarSpec<Id, C> {
  /**
   * Scope of sections governed by this toolbar:
   * - 'all': sticks across the entire dashboard.
   * - string[]: sticks only while scrolling through the specified section IDs.
   */
  scope: 'all' | readonly string[] | string[];
}

/* -------------------------------------------------------------------------- */
/* 3. Project Metadata, Manifest & Translation                                */
/* -------------------------------------------------------------------------- */

/** Data provider or official agency citation for dataset provenance. */
export interface ProjectSource {
  /** Name of the organization or data provider. */
  name: string;
  /** Direct URL to the official source repository or dataset portal. */
  url: string;
}

/** Static project manifest (identity, tags, and section paths) independent of locale and chart builders. */
export interface ProjectManifest {
  /** Unique project slug identifier. */
  id: string;
  /** Categorization and discovery tags for catalog filtering. */
  tags: ProjectTag[];
  /** Ordered list of canonical section IDs matching URL sub-paths (e.g. ['budget-and-debt', ...]). */
  sections: readonly string[];
}

/** Localized text metadata declaration for a project (title, description, and section preview titles). */
export interface ProjectLocaleMeta {
  /** Localized project title. */
  title: string;
  /** Localized project description. */
  description: string;
  /** Localized concise names for sections rendered in catalog preview cards. */
  sections?: Record<string, string>;
}

/** Lightweight metadata declaration of a project for navigation and overview cards in the catalog. */
export interface CatalogProject extends ProjectManifest {
  /** Localized project title. */
  title: string;
  /** Localized project description. */
  description: string;
  /** Localized concise names for sections rendered in catalog preview cards. */
  sectionTitles?: Record<string, string>;
}

/** Localized translation container for a project comprising common phrases, metadata, and chart dictionary. */
export interface ProjectTranslation<D = Record<string, unknown>> {
  common: LocaleCommonDict;
  projMeta: ProjectLocaleMeta;
  proj: D;
}

/** Context passed to section and toolbar builders containing active locale, translations, formatters, and resolved theme tokens. */
export interface ProjectContext<D = Record<string, unknown>> {
  lang: Language;
  t: ProjectTranslation<D>;
  fmt: LocalizedFormatters;
  theme: ResolvedTheme;
  tokens: ThemeColors;
}

/** Function contract for building an individual isolated dashboard section. */
// biome-ignore lint/suspicious/noExplicitAny: section builder allows any section data and dictionary
export type SectionBuilder<TData = any, D = any> = (ctx: ProjectContext<D>) => DashboardSectionSpec<TData, any, any, any>;

/** Static declaration of a dashboard project in the catalog with section builders. */
export interface Project<D = Record<string, unknown>> extends ProjectManifest {
  /** Optional project-level asynchronous data loaders shared across all sections and toolbars. */
  data?: DataLoadersMap;
  /** Optional shared asynchronous data loaders injected into all project sections with reactive stores. */
  sectionData?: DataLoadersMap;
  /** Optional sticky dashboard filter toolbars. */
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic dispatch across project data
  toolbars?: (projectData: Record<string, any>, ctx: ProjectContext<D>) => DashboardToolbarSpec[];
  /** Factory function returning the complete array of configured dashboard sections for the page. */
  buildSections: (ctx: ProjectContext<D>) => DashboardSectionSpec<unknown>[];
}

/* -------------------------------------------------------------------------- */
/* 4. Dashboard Sections & KPIs                                               */
/* -------------------------------------------------------------------------- */

/** Asynchronous data loader contract taking optional reactive filter stores and returning a promise. */
// biome-ignore lint/suspicious/noExplicitAny: generic data loader return type
export type DataLoader<T = any> = (stores?: Record<string, State>) => Promise<T>;

/** Dictionary of asynchronous data loaders. */
export type DataLoadersMap = Record<string, DataLoader>;

/** Infers the resolved record type from a dictionary of data loaders. */
export type InferredData<TLoaders extends DataLoadersMap> = {
  [K in keyof TLoaders]: TLoaders[K] extends DataLoader<infer R> ? R : never;
};

/** Metric KPI card specification rendered above or below dashboard sections. */
export interface KpiCardSpec {
  /** KPI metric title or descriptive label. */
  label: string;
  /** Formatted numerical or string value displayed prominently. */
  value: string | number;
  /** Semantic color variant or custom CSS/Tailwind color string. @default 'default' */
  valueColor?: SemanticColor | (string & {});
}

/** Unified result returned by a section's buildView function. */
export interface SectionViewResult {
  /** The primary visual content of the section (SectionChart, Map, Grid, Custom UI). */
  content: React.ReactNode;
  /** Optional dynamic section title override. */
  title?: string;
  /** Optional dynamic KPI cards positioned above the section card. */
  kpisTop?: KpiCardSpec[];
  /** Optional dynamic KPI cards positioned below the section card. */
  kpisBottom?: KpiCardSpec[];
}

/** Default open stores record type representation allowing coordinated dashboard stores. */
// biome-ignore lint/suspicious/noExplicitAny: open stores record requires any for arbitrary coordinated dashboard store access
export type EmptyStores = Record<string, any>;

/** Maps an array of toolbar specifications into a strongly-typed reactive stores object keyed by toolbar ID. */
export type ToolbarsToValues<T> = [T] extends [readonly ToolbarSpec[]]
  ? {
      [TB in T[number] as TB['id']]: ControlsToValues<TB['controls']>;
    }
  : EmptyStores;

/** Unified dashboard section specification. */
export interface DashboardSectionSpec<
  TData = unknown,
  TSectionData extends DataLoadersMap = Record<string, never>,
  TToolbars extends readonly ToolbarSpec[] | undefined = readonly ToolbarSpec[] | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: open stores record requires any for arbitrary coordinated dashboard store access
  TStores extends Record<string, any> = EmptyStores,
> {
  /** Canonical section identifier matching URL sub-path (e.g. 'budget-and-debt'). */
  id: string;
  /** Optional primary section title. */
  title?: string;
  /** Data provider or official agency citations for dataset provenance. */
  sources?: ProjectSource[];
  /** KPI cards positioned above the section content. */
  kpisTop?: KpiCardSpec[];
  /** KPI cards positioned below the section content. */
  kpisBottom?: KpiCardSpec[];
  /** Optional local data loaders scoped strictly to this section, fetched on viewport entry. */
  data?: TSectionData;
  /** Optional interactive toolbars rendered inside the section card header, statically or computed dynamically from section data. */
  toolbars?: TToolbars | ((data: TData) => TToolbars);
  /** Unified view builder producing section visual content and dynamic metadata overrides. */
  buildView(data: TData, stores: ToolbarsToValues<TToolbars> & TStores): SectionViewResult;
}

/**
 * Fully typed section builder specification scoped to a project's data loaders and dictionary.
 */
export type ProjectSection<
  TProjectLoaders extends DataLoadersMap = Record<string, never>,
  D = Record<string, unknown>,
  // biome-ignore lint/suspicious/noExplicitAny: open stores record requires any for arbitrary coordinated dashboard store access
  TStores extends Record<string, any> = EmptyStores,
> = (ctx: ProjectContext<D>) => DashboardSectionSpec<InferredData<TProjectLoaders>, Record<string, never>, readonly ToolbarSpec[] | undefined, TStores>;

/**
 * Type-safe dashboard section builder.
 */
export function defineSection<
  // biome-ignore lint/suspicious/noExplicitAny: default open project data record allows undeclared coordinated project loaders
  TProjectData = Record<string, any>,
  const TSectionData extends DataLoadersMap = Record<string, never>,
  D = Record<string, unknown>,
  const TToolbars extends readonly ToolbarSpec[] | undefined = undefined,
  // biome-ignore lint/suspicious/noExplicitAny: open stores record requires any for arbitrary coordinated dashboard store access
  TStores extends Record<string, any> = EmptyStores,
>(builder: (ctx: ProjectContext<D>) => DashboardSectionSpec<TProjectData & InferredData<TSectionData>, TSectionData, TToolbars, TStores>): SectionBuilder<unknown, D> {
  return builder as unknown as SectionBuilder<unknown, D>;
}

/* -------------------------------------------------------------------------- */
/* 5. Project Factory Builder                                                 */
/* -------------------------------------------------------------------------- */

/** Configuration descriptor for defining a typed dashboard project. */
export interface DefineProjectConfig<D = Record<string, unknown>, TDataLoaders extends DataLoadersMap = Record<string, never>, TSectionLoaders extends DataLoadersMap = Record<string, never>> {
  /** Static project manifest containing ID, tags, and canonical section IDs. */
  meta: ProjectManifest;
  /** Optional project-level data loaders evaluated once on mount for toolbars. */
  data?: TDataLoaders;
  /** Optional shared reactive section data loaders evaluated inside sections on viewport entry. */
  sectionData?: TSectionLoaders;
  /** Ordered array of section builders or eagerly resolved glob dictionary. */
  sections: readonly SectionBuilder<unknown, D>[] | Record<string, unknown>;
  /** Optional sticky dashboard filter toolbars factory. */
  toolbars?: (data: InferredData<TDataLoaders>, ctx: ProjectContext<D>) => DashboardToolbarSpec[];
}

/**
 * Declares a fully typed dashboard project specification, automatically wiring section modules
 * and validating canonical section ordering from project metadata.
 */
export function defineProject<D = Record<string, unknown>, const TDataLoaders extends DataLoadersMap = Record<string, never>, const TSectionLoaders extends DataLoadersMap = Record<string, never>>(
  config: DefineProjectConfig<D, TDataLoaders, TSectionLoaders>,
): Project<D> {
  const { meta, data, sectionData, sections, toolbars } = config;

  return {
    ...meta,
    data,
    sectionData,
    toolbars: toolbars as Project<D>['toolbars'],
    buildSections: (ctx) => {
      if (Array.isArray(sections)) {
        return sections.map((builder) => builder(ctx));
      }
      const globSections = sections as Record<string, unknown>;
      return meta.sections.map((id) => {
        const pathKeyTsx = `./sections/${id}.tsx`;
        const pathKeyTs = `./sections/${id}.ts`;
        const mod = (globSections[pathKeyTsx] ?? globSections[pathKeyTs]) as Record<string, SectionBuilder<unknown, D>> | undefined;
        if (!mod) {
          throw new Error(`Section module missing: ${pathKeyTsx} in project '${meta.id}'`);
        }
        const builder = Object.values(mod)[0];
        if (typeof builder !== 'function') {
          throw new Error(`Default section builder function missing in: ${pathKeyTsx}`);
        }
        return builder(ctx);
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Project Registry & Dynamic Loaders                                      */
/* -------------------------------------------------------------------------- */

const metaModules = import.meta.glob<{ meta: ProjectManifest }>('../projects/*/meta.ts', { eager: true });
const projectLoaders = import.meta.glob<{ project: Project }>('../projects/*/project.ts');
const metaLoaders = import.meta.glob<{ meta: ProjectLocaleMeta }>('../projects/*/locales/meta-*.ts');
const dictLoaders = import.meta.glob<{ dict: Record<string, unknown> }>('../projects/*/locales/dict-*.ts');

/** Canonical static project manifest descriptors discovered dynamically from project slices. */
export const STATIC_PROJECT_INFOS: ProjectManifest[] = Object.values(metaModules).map((mod) => mod.meta);

/** Map of static project metadata indexed by project slug for instant synchronous validation. */
export const STATIC_PROJECT_MAP: Record<string, ProjectManifest> = Object.fromEntries(STATIC_PROJECT_INFOS.map((p) => [p.id, p]));

/** Alphabetically sorted list of all unique category tags across registered projects. */
export const ALL_UNIQUE_TAGS: ProjectTag[] = Array.from(new Set(STATIC_PROJECT_INFOS.flatMap((p) => p.tags))).sort();

/** In-memory cache for localized catalog descriptors. */
const catalogCache = new Map<Language, Promise<CatalogProject[]>>();

/** Asynchronously loads localized project catalog descriptors for the active language. */
export function loadCatalog(lang: Language): Promise<CatalogProject[]> {
  let promise = catalogCache.get(lang);
  if (!promise) {
    promise = Promise.all(
      STATIC_PROJECT_INFOS.map(async (info) => {
        const loader = metaLoaders[`../projects/${info.id}/locales/meta-${lang}.ts`];
        const mod = loader ? await loader() : null;
        return {
          ...info,
          title: mod?.meta.title ?? info.id,
          description: mod?.meta.description ?? '',
          sectionTitles: mod?.meta.sections ?? {},
        };
      }),
    );
    catalogCache.set(lang, promise);
  }
  return promise;
}

/** Complete project bundle containing specification and localized dictionaries. */
export interface ProjectBundle {
  project: Project;
  t: {
    projMeta: ProjectLocaleMeta;
    proj: Record<string, unknown>;
  };
}

/** In-memory cache for dynamically imported project bundles. */
const bundleCache = new Map<string, Promise<ProjectBundle>>();

/** Asynchronously loads the complete project bundle (specification and localized dictionary) in parallel. */
export function loadProjectBundle(slug: string, lang: Language): Promise<ProjectBundle> {
  const cacheKey = `${slug}:${lang}`;
  let promise = bundleCache.get(cacheKey);
  if (!promise) {
    const projectLoader = projectLoaders[`../projects/${slug}/project.ts`];
    if (!projectLoader) {
      throw new Error(`Project specification not found: ${slug}`);
    }
    const metaLoader = metaLoaders[`../projects/${slug}/locales/meta-${lang}.ts`];
    if (!metaLoader) {
      throw new Error(`Locale meta file not found for project: ${slug}, lang: ${lang}`);
    }
    const dictLoader = dictLoaders[`../projects/${slug}/locales/dict-${lang}.ts`];
    if (!dictLoader) {
      throw new Error(`Locale dict file not found for project: ${slug}, lang: ${lang}`);
    }

    promise = Promise.all([projectLoader(), metaLoader(), dictLoader()]).then(([projectMod, metaMod, dictMod]) => ({
      project: projectMod.project,
      t: {
        projMeta: metaMod.meta,
        proj: dictMod.dict,
      },
    }));
    bundleCache.set(cacheKey, promise);
  }
  return promise;
}

/** Fetches a static JSON dataset chunk, reading from local filesystem during SSG/SSR or fetching via HTTP in browser. */
async function fetchDatasetJson<T>(...segments: string[]): Promise<T> {
  const subPath = segments.join('/');
  if (import.meta.env.SSR) {
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises');
    const { resolve } = await import(/* @vite-ignore */ 'node:path');
    const publicDir = process.cwd().endsWith('site') ? 'public/data' : 'site/public/data';
    const filePath = resolve(process.cwd(), publicDir, ...segments);
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  }
  const url = `/data/${subPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${subPath}`);
  return (await res.json()) as T;
}

/** In-memory cache for loaded static datasets. */
const datasetCache = new Map<string, Promise<unknown>>();

export function loadDataset<T = unknown>(...segments: string[]): Promise<T> {
  const cacheKey = segments.join('/');
  let promise = datasetCache.get(cacheKey);
  if (!promise) {
    promise = fetchDatasetJson<T>(...segments);
    datasetCache.set(cacheKey, promise);
  }
  return promise as Promise<T>;
}
