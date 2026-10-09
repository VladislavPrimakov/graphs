# AGENTS.md — Agent Operating Manual & Repository Rulebook

Operational guide and rulebook for AI agents working on the `graphs` repository.

---

## 1. Operating Rules & Engineering Standards

### 1.1 Verification Commands
- **Frontend / UI Changes**: Run `bun run build:site` (runs Knip, Biome format/lint, TypeScript `tsc --noEmit`, and multi-locale SSG pre-rendering). Granular checks: `bun --filter @graphs/site check`, `type-check`, `knip`.
- **Data Scrapers / Pipelines**: Run `bun run build:pipeline`. Run `bun test` ONLY when modifying parser code covered by unit tests (`pipelines/src/war-rf-ua/parse-attacks-ua.ts` and `*.test.ts`). Never run `bun test` for UI, styles, or locales.
- **Full CI Verification**: Run `bun run build` (builds pipelines + site across all locales).
- **Execution Invariant**: Never invoke background `schedule` timers or polling loops while waiting for command execution; rely exclusively on automatic reactive system notifications.
- **React 19 & React Compiler**: React Compiler (`babel-plugin-react-compiler`) optimizes components/hooks at build time. Never write manual `useMemo` or `useCallback`.
- **English Policy**: All comments, JSDoc, identifiers, and types must be 100% English. Non-English text is strictly isolated to localization dictionaries (`site/src/locales/**` and `site/src/projects/<slug>/locales/**`).
- **Hygiene**: Never commit temporary files (`*.tmp`, `*.log`) or scratch scripts.

### 1.2 Code Documentation & Conventions
- **JSDoc**: Use `/** ... */` for exported symbols; omit `@param` and `@returns`. Keep field descriptions single-line with `@default` and explicit units (`USD`, `TWh`, `px`, `%)`.
- **Naming**: `PascalCase` for types/components; `camelCase` for variables, functions, and properties; `SCREAMING_SNAKE_CASE` for global constants; `kebab-case` for files, slugs, and section IDs.
- **Changelog SSoT (`CHANGELOG.md`)**: Keep a Changelog format with STRICT workspace section ordering within every release:
  1. `### Tooling & Types`
  2. `### Pipelines (@graphs/pipelines)`
  3. `### Site (@graphs/site)`
  Separated by `---`. Use Factorio/Wube style: active past-tense verbs (`Added`, `Fixed that`, `Changed`, `Removed`, `Extracted`), zero fluff, exact backticked identifiers.
- **Package Versioning**: Workspace `package.json` files omit `"version"`. Milestones exist exclusively in `CHANGELOG.md`.

---

## 2. End-to-End Architecture & Data Contracts

```
[ Upstream Sources ] ──(on -u / cache miss)──> [ Tier 1: pipelines/src/<slug>/data*.json ] (Committed Minimal Baseline)
                                                              │ (pure in-memory transform & aggregate)
                                                              ▼
[ types/ ] ──(Subpath SSoT)──> [ site/ ] <─── [ Tier 2: site/public/data/<slug>/<section>/data.json ] (Ephemeral SSG Data)
```

### 2.1 Two-Tier Data Architecture
1. **Tier 1 (Committed Minimal Snapshot)**: `pipelines/src/<slug>/data.json` (or `data-losses.json`, `data-attacks-ua.json`, `data-attacks-rf.json`, `data-frontline.json` for `war-rf-ua`). Committed minimal raw offline baseline; strips upstream XML/SVG overhead.
2. **Tier 2 (Ephemeral Production Dataset)**: `site/public/data/<slug>/<sectionId>/data.json` (or `site/public/data/<slug>.json`). Compact single-line JSON build artifacts gitignored by default, exported via `exportProjectSections` / `exportDataset`.
- **Invariants**: `bun run build:site` requires Tier 2 datasets (run `bun run build:pipeline` first on fresh clones). CI runs every 3 days or on push to `main`.

### 2.2 Pipelines & ETL Lifecycle
- **CLI**: Run all: `bun run build:pipeline`. Run single: `bun --filter @graphs/pipelines run:<slug>`. Flags: `-u` (force download), `-v` (verbose logs).
- **In-Memory Ingestion**: Scraping, XML parsing, and CSV downloads must occur in memory. Never write temporary cache files to disk. Default execution is cache-first against Tier 1 snapshots.
- **Pre-Computation**: All domain aggregations, totals, and timeline pivots are computed in ETL. Static datasets output compact camelCase JSON strings matching `@graphs/types` schemas.
- **Shared Utilities (`pipelines/src/utils/`)**: `paths.ts` (path resolution), `dataset.ts` (`exportDataset`, `exportProjectSections`), `http.ts` (`fetchWithRetry`, `fetchHeadMeta`), `region.ts` (`resolveRegionCode`), `fs.ts` (`writeJson`, `readJson`), `logger.ts` (`getLogger`), `math.ts` (rounding/aggregation helpers), `metadata.ts` (`updateMetadata`).
- **Constraint for `parse-attacks-ua.ts`**: Strictly prohibits any comments (`//`, `/* */`) or docstrings.

---

## 3. Frontend & Visualization Architecture

### 3.1 Structure & Dynamic Loading
- **Structure**: Pages in `site/src/pages/`, modular components in `site/src/components/` (`layout/`, `sections/`, `ui/`, `icons/`), and self-contained project slices in `site/src/projects/<slug>/` (`meta.ts`, `project.ts`, `sections/<section-id>.ts`, `locales/`).
- **Three-Tier Dynamic Loading & Code-Splitting**:
  - **Tier 1 (Root Locale)**: `loadRootLocale(lang)` in `root.tsx` loads `common-{lang}.ts`, CLDR formats, and `loadCatalog` into `<AppProvider>`.
  - **Tier 2 (Project Bundle)**: `loadProjectBundle(slug, lang)` loads project specification and localized dictionaries (`dict-{lang}.ts`, `meta-{lang}.ts`) via React 19 `use()`.
  - **Tier 3 (Per-Section Datasets)**: `loadSectionData(slug, sectionId)` asynchronously loads typed section JSON (`public/data/<slug>/<sectionId>/data.json`) on demand when `<Section>` approaches the viewport (`useInView`).
  - **Component Code-Splitting**: Heavy client visualizers (`SectionChart`, `FrontlineMap`, `LossesMap`) are dynamically imported via `React.lazy()` with fallback `<LoadingSpinner />`.
- **SectionHeader Architecture**: Dynamic 3-column mathematical centering, top-aligned anchor button and first action on row 1, subsequent actions stacked below row 1, and width caching across breakpoints to prevent layout jitter.
- **React 19 Concurrency**: Use `startTransition` for interactive control/filter state updates to keep UI smooth. Use `useEffectEvent` for non-reactive callbacks. Decouple `ResizeObserver` in `SectionChart.tsx` to pause off-screen canvas redraws.
- **Smart Navigation & Programmatic Scroll Locking**: Deep-linking (`/:slug/:section`) and outline clicks smoothly transition between sections while `useInView` programmatic locking (`startScrollLock`) and dynamic header clipping (`-${getHeaderHeight()}px 0px 400px 0px`) completely suppress intermediate JSON fetching and canvas rendering during fast scroll flight. `useScrollSpy` clips the bottom 400px reading boundary and syncs URL/title on native `scrollend`. `<AnchorButton>` copies deep-links without mutating history.

### 3.2 Polymorphic Sections & Visualization Invariants
- **`DashboardSection` Discriminated Union**: `ChartSectionSpec` (`type: 'chart'`, defined via `chartSection`), `BreakdownGridSpec` (`type: 'breakdown-grid'`), and `CustomSectionSpec` (`type: 'custom'`).
- **Clean Y-Axis**: Never attach currency symbols, percent signs, or units to Y-axis tick labels via `axisLabel.formatter`. Units belong strictly in `yAxis.name`. `axisLabel.formatter` is permitted exclusively in diverging mirrored charts to strip negative signs (`Math.abs`).
- **Declarative Tooltips (`chartOption`)**: Zero raw HTML strings in tooltip formatters. Use declarative `tooltip: { type: 'axis' | 'dual' | 'table', ... }` with automatic type inference and auto-sorting (`sort: 'desc'`).
- **Canvas Theme Enhancement (`enhanceOption`)**: `<SectionChart>` injects fonts, dark/light grid clearance, tooltips, and toolbox controls automatically. Always update canvases with `notMerge: true` (`chart.setOption(option, true)`).
- **PNG Chart Export (`exportChartAsPng`)**: Generates 2D canvas composite with centered section title, solid card surface background (`tokens.surface.card`), automatic `dataZoom` bottom margin cropping, and native ECharts downward-arrow icon.
- **Localization**: Pure TypeScript SSoT (`typeof` contracts + `satisfies` validation across `en`, `ru`, `uk`, `de`). Zero trailing colons or punctuation in dictionary values. Default language (`en`) has no URL prefix (`/:slug/:section`); non-default languages use `/:lang/...`.

### 3.3 Core Utilities & Design System
- **Utilities (`site/src/utils/`)**: `format.ts` (CLDR formatting `fmt.*`), `color.ts` (`resolveColor`), `cn.ts` (class merging), `chart-builder.ts` (`chartOption`, `zipRecords`, `createBarSeries`, `exportChartAsPng`), `tooltip-builder.ts` (pure HTML tooltips/popups), `map-builder.ts` (MapLibre vector styles/layers), `useInView.ts` (lazy viewport observer), `useScrollSpy.ts` (telemetry/scrollend sync), `provider.tsx` (`AppProvider`, `useTheme`, `useLanguage`, `useTranslation`, `useFormat`, `useCatalog`), `version.ts` (`SITE_VERSION`).
- **Styles (`site/src/styles/`)**: `global.css` (Tailwind v4 `@theme`, container utilities: `glass-bar`, `glass-overlay`, `card`, `card-elevated`, `control-panel`, `btn-subtle`, `btn-accent`, `nav-pill`, `anchor-btn`), `tags.css` (`@utility tag-pill`), `changelog.css`, `map.css`, `tokens.ts`. Prefer standard utility classes over arbitrary pixel brackets.
- **Responsive Invariant**: Avoid arbitrary responsive modifier jumping (`sm:`, `md:`) on gaps, paddings, and font sizes; keep responsive adaptations strictly confined to global navbar drawer collapsing and section header action stacks.
- **Mandatory Imports**: Use `@/*` aliases in `site/src/`. Import types from subpaths `@graphs/types/<slug>/<section-id>`.

---

## 4. New Dashboard Registration Checklist

To register a new dashboard slice:
1. **Section Schemas (`types/<slug>/<section-id>.ts`)**: Define TypeScript interfaces (`*SectionData`) exported via subpaths `@graphs/types/<slug>/<section-id>`.
2. **ETL Pipeline (`pipelines/src/<slug>/index.ts`)**: Scrape/parse data, output compact JSONs via `exportProjectSections`, and update `metadata.json`.
3. **Pipeline Runner (`pipelines/src/run-all.ts`)**: Register in `PIPELINES` registry and package scripts.
4. **Project Module (`site/src/projects/<slug>/`)**:
   - `meta.ts`: Export static metadata `export const meta: StaticProjectMeta = { id, tags, sources, sections }`.
   - `sections/<section-id>.ts`: Implement section builders (`export const <name>Section: SectionBuilder = ...`).
   - `locales/meta-{lang}.ts` & `locales/dict-{lang}.ts`: Export localized `meta` and `dict` across all 4 locales (`en`, `ru`, `uk`, `de`).
   - `project.ts`: Export specification `export const project: Project = { ...meta, buildSections: (ctx) => [...] }`.
