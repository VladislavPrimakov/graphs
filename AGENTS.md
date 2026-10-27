# AGENTS.md — Agent Operating Manual & Repository Rulebook

Operational guide and rulebook for AI agents working on the `graphs` repository.

---

## 1. Operating Rules & Engineering Standards

### 1.1 Verification Commands
- **Frontend / UI Changes**: Run `bun run build:site` (runs Knip, Biome format/lint, TypeScript `tsc --noEmit`, and multi-locale SSG pre-rendering). Granular checks: `bun --filter @graphs/site check`, `type-check`, `knip`. Root configuration is `tsconfig.base.json`; each workspace extends it via its own `tsconfig.json`.
- **Data Scrapers / Pipelines**: Run `bun run build:pipeline`. Granular test suites: `bun --filter @graphs/pipelines test:country`, `test:war-rf-ua`, `test:space-launches`, `test:world`. Never run `bun test` for UI, styles, or locales (`site/package.json` includes `test:meta` exclusively to validate pre-rendered SSG metadata and OG assets).
- **Full CI Verification**: Run `bun run build` (builds pipelines + site across all locales).
- **Execution Invariant**: Never invoke background `schedule` timers or polling loops while waiting for command execution; rely exclusively on automatic reactive system notifications.
- **React 19 & React Compiler**: React Compiler (`babel-plugin-react-compiler`) optimizes components/hooks at build time. Never write manual `useMemo` or `useCallback`.
- **English Policy**: All comments, JSDoc, identifiers, and types must be 100% English. Non-English text is strictly isolated to localization dictionaries (`site/src/locales/**` and `site/src/projects/<slug>/locales/**`), with narrow domain exceptions in `site/src/utils/format-locale.ts` (`HISTORICAL_AND_REGIONAL_NAMES`), `site/src/utils/format.ts` (decade suffixes), `site/src/utils/provider.tsx` (native language names), and official Ukrainian scraper tokens in `pipelines/src/ukraine/`.
- **Hygiene**: Never commit temporary files (`*.tmp`, `*.log`) or scratch scripts.

### 1.2 Code Documentation & Conventions
- **JSDoc**: Use `/** ... */` for exported symbols; omit `@param` and `@returns`. Keep field descriptions single-line with `@default` and explicit units (`USD`, `TWh`, `px`, `%)`.
- **Naming**: `PascalCase` for types/components; `camelCase` for variables, functions, and properties; `SCREAMING_SNAKE_CASE` for global constants; `kebab-case` for files, slugs, and section IDs.
- **Changelog SSoT (`CHANGELOG.md`)**: Keep a Changelog format with STRICT workspace section ordering within every release:
  1. `### Tooling`
  2. `### Pipelines (@graphs/pipelines)`
  3. `### Site (@graphs/site)`
  Separated by `---`. Use Factorio/Wube style: active past-tense verbs (`Added`, `Fixed that`, `Changed`, `Removed`, `Extracted`), zero fluff, exact backticked identifiers.
  - **High-Signal & Significance Invariant**: Record strictly major architectural, domain, and user-facing milestones.
  - **Forbidden Noise**: Never log test additions/updates, routine code formatting, intermediate refactorings, internal documentation changes (`AGENTS.md`, README), CI workflow tweaks, trivial localized strings/empty states, or non-breaking minor dependency bumps.
  - **Consolidation**: Group related pipeline algorithms, domain models, and UI control updates into single coherent, high-level bullets rather than itemizing per-function or per-file micro-changes.
- **Package Versioning**: Workspace `package.json` files omit `"version"`. Milestones exist exclusively in `CHANGELOG.md`.

---

## 2. End-to-End Architecture & Data Contracts

```
[ Upstream Sources ] ──(on -u / cache miss)──> [ Tier 1: pipelines/src/<slug>/data*.json.br ] (Committed Minimal Baseline)
                                                              │ (pure in-memory transform & aggregate)
                                                              ▼
[ shared/types/ ] ──(Subpath SSoT)──> [ site/ ] <─── [ Tier 2: site/public/data/<slug>/<section>/data.json ] (Ephemeral SSG Data)
```

### 2.1 Two-Tier Data Architecture
1. **Tier 1 (Committed Minimal Snapshot)**: `pipelines/src/<slug>/data.json.br` (or `data-losses.json.br`, `data-attacks-ua.json.br`, `data-attacks-rf.json.br`, `data-frontline.json.br`, `classification.json.br` for `war-rf-ua`). Committed minimal raw offline baseline; compressed via Brotli quality 9. Strips upstream XML/SVG overhead.
   - **Explicit Null Contract**: Streams confirmed empty by upstream must be saved as `null`, reserving `undefined` strictly for unqueried or failed streams. Empty `{}` objects are strictly forbidden in Tier 1 snapshots.
2. **Tier 2 (Ephemeral Production Dataset)**: `site/public/data/<slug>/<sectionId>/data.json` (or `site/public/data/<slug>/<code>.json`) and optional project toolbar metadata `site/public/data/<slug>/toolbar-meta.json`. Compact single-line JSON build artifacts gitignored by default, exported via `exportDataset` / `exportProjectMeta`.
- **Invariants**: `bun run build:site` requires Tier 2 datasets (run `bun run build:pipeline` first on fresh clones). CI runs every 3 days via cron (`0 3 */3 * *`) or on release tag push (`v*`).

### 2.2 Pipelines & ETL Lifecycle
- **CLI**: Run all: `bun run build:pipeline`. Run single: `bun --filter @graphs/pipelines run:<slug>`. Flags: `-u` (force download), `-v` (verbose logs).
- **In-Memory Ingestion**: Scraping, XML parsing, and CSV downloads must occur in memory. Never write temporary cache files to disk. Default execution is cache-first against Tier 1 snapshots.
- **Pre-Computation**: All domain aggregations, totals, and timeline pivots are computed in ETL. Static datasets output compact camelCase JSON strings matching `@graphs/shared/types` schemas.
- **Rate Limiting & Pacing Invariant**: External API scrapers subject to rate limits must use serialized pacer queues. UN Comtrade requests must strictly obey `COMTRADE_PACER_DELAY_MS = 1000` (1 request/second) with automatic circuit breaker on daily call volume quota exhaustion (HTTP 403).
- **Shared Utilities (`pipelines/src/utils/`)**: `paths.ts` (path resolution, `loadEnv`), `dataset.ts` (`exportDataset`, `exportProjectMeta`), `http.ts` (`fetchWithRetry`, `fetchHeadMeta`), `region.ts` (`resolveRegionCode`), `fs.ts` (`writeJsonAsync`, `readJson`, `readJsonSync`), `logger.ts` (`getLogger`), `math.ts` (re-exports from `@graphs/shared/math`), `metadata.ts` (`updateMetadata`).
- **Constraint for `parse-attacks-ua.ts`**: Strictly prohibits any comments (`//`, `/* */`) or docstrings.

---

## 3. Frontend & Visualization Architecture

### 3.1 Structure & Dynamic Loading
- **Structure**: Pages in `site/src/pages/`, modular components in `site/src/components/` (`layout/`, `sections/`, `ui/`, `icons/`), and self-contained project slices in `site/src/projects/<slug>/` (`meta.ts`, `project.ts`, `sections/<section-id>.ts`, `locales/`).
- **Four-Tier Dynamic Loading & Code-Splitting**:
  - **Tier 1 (Root Locale)**: `loadRootLocale(lang)` in `root.tsx` loads `common-{lang}.ts`, CLDR formats, and `loadCatalog` into `<AppProvider>`.
  - **Tier 2 (Project Bundle)**: `loadProjectBundle(slug, lang)` loads project specification and localized dictionaries (`dict-{lang}.ts`, `meta-{lang}.ts`) via React 19 `use()`.
  - **Tier 3 (Project Data & Toolbar Metadata)**: Precomputed project metadata or shared datasets declared in `project.data = { [key]: () => loadDataset(...) }` are loaded via React 19 `use()` during toolbar evaluation.
  - **Tier 4 (Per-Section Datasets)**: Section datasets declared in `section.data = { [key]: () => loadDataset(...) }` (or shared `project.sectionData`) are loaded via React 19 `use()` on demand when `<Section>` approaches the viewport (`useInView`).
  - **Component Code-Splitting**: Heavy visualizers with external engines (`FrontlineMap`, `LossesMap` with MapLibre) are dynamically imported via `React.lazy()` with fallback `<LoadingSpinner />`. `SectionChart` is statically imported via `createChart`.
- **SectionHeader Architecture**: 3-column CSS grid (`grid-cols-[1fr_auto_1fr]`) with mathematically centered title, left-aligned anchor button, and right-aligned actions; automatically transitions to vertical column stacking (`isStacked`) when container width is insufficient for title and anchors without wrapping.
- **React 19 Concurrency**: Use `startTransition` for interactive control/filter state updates to keep UI smooth. Use `useEffectEvent` for non-reactive callbacks. `SectionChart.tsx` relies on `useSectionResize` (window/body resize subscriptions deferred while offscreen) and `queueChartRender` for frame-staggered canvas rendering.
- **Smart Navigation & Programmatic Scroll Locking (`viewport.ts`)**: Deep-linking (`/:slug/:section`) and outline clicks smoothly transition between sections while `useInView` programmatic locking (`startScrollLock`) and dynamic header clipping (`-${getHeaderHeight()}px 0px 400px 0px`) completely suppress intermediate JSON fetching and canvas rendering during fast scroll flight. `useScrollSpy` clips the bottom 400px reading boundary and syncs URL/title on native `scrollend`. `<AnchorButton>` copies deep-links without mutating history.

### 3.2 Unified Section Contract & Visualization Invariants
- **Unified Section Contract (`defineSection`)**: Every section shares an identical uniform contract declared via `defineSection`:
  `id`, `title`, `sources`, optional `toolbars`, optional `kpisTop`, optional `kpisBottom`, and `buildView: (data, stores?) => SectionViewResult` returning `{ content: ReactNode, title?, kpisTop?, kpisBottom? }`. Direct `ReactNode` return is invalid. No discriminated union of section types (`chart`/`breakdown-grid`/`custom`).
- **Canvas Visualizer Helper (`createChart`)**: Chart options returned from `chartOption(...)` are wrapped in `createChart(chartOption(...))` in `site/src/components/sections/SectionChart.tsx`. Custom views (maps, grids) render components directly (`createElement(FrontlineMap, ...)`, `<SectionBreakdown ... />`).
- **Time-Series Period Clamping (`resolveVisiblePeriod`)**: Never write manual `years.findIndex` or `years.findLastIndex` boundary slicing in section builders. Use `resolveVisiblePeriod(years, store.years, { seriesData: activeSeriesList })` from `@/utils/chart-builder`. It clamps requested bounds, safely handles non-overlapping intervals (`hasOverlap: false`), and dynamically trims leading/trailing all-null periods across active series (e.g. UNIDO SDG starting at 2000, YoY growth starting at 2001, or countries reporting shorter periods).
- **Clean Y-Axis**: Never attach currency symbols, percent signs, or units to Y-axis tick labels via `axisLabel.formatter`. Units belong strictly in `yAxis.name`. `axisLabel.formatter` is permitted exclusively in diverging mirrored charts to strip negative signs (`Math.abs`).
- **Declarative Tooltips (`chartOption`)**: Zero raw HTML strings in tooltip formatters. Use declarative `tooltip: { type: 'axis' | 'dual' | 'table', ... }` with automatic type inference and auto-sorting (`sort: 'desc'`).
- **Canvas Theme Enhancement (`enhanceOption`)**: `<SectionChart>` injects fonts, dark/light grid clearance, tooltips, and toolbox controls automatically. Always update canvases with `notMerge: true` (`chart.setOption(option, true)`).
- **PNG Chart Export (`exportChartAsPng`)**: Generates 2D canvas composite with centered section title, solid card surface background (`tokens.surface.card`), automatic `dataZoom` bottom margin cropping, and native ECharts downward-arrow icon.
- **Localization**: Pure TypeScript SSoT (`typeof` contracts + `satisfies` validation across `en`, `ru`, `uk`, `de`). Zero trailing colons or punctuation in dictionary values. Default language (`en`) has no URL prefix (`/:slug/:section`); non-default languages use `/:lang/...`.

### 3.3 Interactive Controls & Reactive Store Architecture
- **Supported Control Types**: `slider` (number), `range-slider` ([number, number]), `toggle` (string union), `checkbox` (boolean), `single-search-select` (string), `multi-search-select` (string[]), `timeline-scrubber` ([string, string]).
- **Control Lifecycle SSoT Invariant (CRITICAL)**:
  When adding or updating any interactive control type, ALL 3 layers MUST be kept in sync:
  1. **Contract & Typings (`site/src/utils/project.ts`)**: Add interface extending `BaseControl`, register mapped value type in `ControlValueMap`, add to `Control` discriminated union.
  2. **Reactive Store & URL Sync (`site/src/utils/store.ts`)**:
     - `defaultState`: Initialize default value (e.g. `ctrl.defaultValue` or bounds from `min`/`max`/`periods`).
     - `parse`: Parse URL query value (support comma-delimited strings/arrays for tuples/lists, parse numbers/booleans, clamp within valid bounds).
     - `serialize`: Uses `isEqual(val, def)` against `defaultState` to write active non-default filters to query params `${scopeId}.${ctrl.id}`.
  3. **Control Rendering (`site/src/components/ui/ControlBar.tsx`)**: Implement case in `ControlField` switch statement.
- **SSG Hydration & URL Sync Invariant (`store.ts`)**: Stores initialize with `defaultState` matching pre-rendered SSG HTML. On client mount, `syncFromUrl()` runs in a microtask on subscription to trigger authentic React reconciliation without hydration mismatch. URL query parsing for toggles and search-selects must normalize casing against canonical options. Slider dragging is buffered ephemerally, committing to the reactive store only on pointer release (`onValueCommit`).
- **Toolbar Scopes & Sticky Layout**:
  - **Section Toolbars**: Declared in section `toolbars: [...]`. Scoped to the toolbar ID; stored as `${toolbarId}.${controlId}`.
  - **Dashboard/Coordinated Toolbars**: Declared in project `toolbars: (data, ctx) => [...]` with `scope: 'all' | readonly string[] | string[]` designating which sections subscribe to this store `${toolbarId}.${controlId}`. Multiple sections receive coordinated state in `buildView(data, stores)`.
  - **Layout Invariant in `ControlBar`**: Compact controls (`toggle`, `slider`, `checkbox`, `single-search-select`, `multi-search-select`) render inline on row 1 mathematically centered with the `Reset` button on the right. Full-width controls (`timeline-scrubber`) render spanning 100% width (`w-full`) underneath row 1.

### 3.4 Core Utilities & Design System
- **Utilities (`site/src/utils/`)**: `project.ts` (`defineSection`, `defineProject`, `loadDataset`, `loadProjectBundle`), `store.ts` (`getOrCreateStoreFromControls`, `useCombinedStores`), `viewport.ts` (`useInView`, `useScrollSpy`, `startScrollLock`, `scrollToSection`), `format.ts` (CLDR formatting `fmt.*`), `format-locale.ts` (`resolveAdditionalRegionName`), `color.ts` (`resolveColor`), `cn.ts` (class merging), `chart-builder.ts` (`chartOption`, `zipRecords`, `createBarSeries`, `exportChartAsPng`, `resolveEffectiveMax`, `resolveVisiblePeriod`), `tooltip-builder.ts` (pure HTML tooltips/popups), `map-builder.ts` (MapLibre vector styles/layers), `provider.tsx` (`AppProvider`, `useTheme`, `useLanguage`, `useTranslation`, `useFormat`, `useCatalog`), `version.ts` (`SITE_VERSION`).
- **Interactive Components (`site/src/components/ui/`)**: `ControlBar.tsx` (`ControlBar`, `DashboardToolbars`), `TimelineScrubber.tsx`, `DatePickerPopover.tsx`, `SearchSelect.tsx`, `Slider.tsx`, `ToggleGroup.tsx`, `Checkbox.tsx`, `AnchorButton.tsx`, `KpiCard.tsx`, `TagBadge.tsx`.
- **Styles (`site/src/styles/`)**: `global.css` (Tailwind v4 `@theme`, container utilities: `glass-bar`, `glass-overlay`, `card`, `card-elevated`, `control-panel`, `btn-subtle`, `btn-accent`, `nav-pill`, `anchor-btn`), `tags.css` (`@utility tag-pill`), `changelog.css`, `map.css`, `tokens.ts`. Prefer standard utility classes over arbitrary pixel brackets.
- **Responsive Invariant**: Avoid arbitrary responsive modifier jumping (`sm:`, `md:`) on gaps, paddings, and font sizes; keep responsive adaptations strictly confined to global navbar drawer collapsing and section header action stacks.
- **Mandatory Imports**: Use `@/*` aliases in `site/src/`. Import types from subpaths `@graphs/shared/types/<slug>` (or `@graphs/shared/types/<slug>/<section-id>`). Import shared mathematical helpers from `@graphs/shared/math`.

---

## 4. New Dashboard Registration Checklist

To register a new dashboard slice:
1. **Section Schemas (`shared/src/types/<slug>/index.ts`)**: Define TypeScript interfaces (`*SectionData`) exported via subpaths `@graphs/shared/types/<slug>`.
2. **ETL Pipeline (`pipelines/src/<slug>/index.ts`)**: Scrape/parse data, output compact JSONs via `exportDataset` (and `exportProjectMeta` if coordinated toolbar metadata is needed), and update `metadata.json`.
3. **Pipeline Runner (`pipelines/src/run-all.ts`)**: Register in `PIPELINES` registry and package scripts.
4. **Project Module (`site/src/projects/<slug>/`)**:
   - `meta.ts`: Export static metadata `export const meta = { id, tags, sections } as const satisfies ProjectManifest;` (sources are declared per-section in `defineSection`).
   - `sections/<section-id>.ts`: Implement section builders via `defineSection`:
     `export const <name>Section = defineSection(({ t, fmt }) => ({ id, title, sources, toolbars?, buildView: (data, stores?) => ({ content }) }))`.
   - `locales/meta-{lang}.ts` & `locales/dict-{lang}.ts`: Export localized `meta` and `dict` across all 4 locales (`en`, `ru`, `uk`, `de`).
   - `project.ts`: Export specification via `defineProject`:
     `export const project = defineProject<typeof dict, typeof data, typeof sectionData>({ meta, data?, sectionData?, sections: import.meta.glob('./sections/*.ts', { eager: true }), toolbars?: (data, ctx) => [...] })`.
