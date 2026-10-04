# AGENTS.md — Agent Operating Manual & Repository Rulebook

Operational guide and rulebook for AI agents working on the `graphs` repository.

---

## 1. General Operating Rules & Standards

### 1.1 Operating Standards
- **Verification Commands**:
  - **Frontend / UI Changes**: Run `bun run build:site` (runs Knip dead-code check, Biome check/format, TypeScript `tsc --noEmit`, and multi-locale static SSG pre-rendering in a single command). Fast granular checks: `bun --filter @graphs/site check`, `bun --filter @graphs/site type-check`, `bun --filter @graphs/site check:knip`.
  - **Data Scrapers / Pipelines**: Run `bun run build:pipeline`. Run `bun test` ONLY when modifying parser code covered by unit tests (`pipelines/src/war-rf-ua-attacks/parse-ua.ts` and `*.test.ts`). Never run `bun test` for frontend/UI, chart options, styles, or locales.
  - **Full CI Verification**: Run `bun run build` (builds pipelines + site across all locales).
- **Execution Invariant**: Never invoke background `schedule` timers or polling loops while waiting for command execution; rely exclusively on automatic reactive system notifications.
- **React 19 & React Compiler**: React Compiler (`babel-plugin-react-compiler`) automatically optimizes components and hooks at build time. Never write manual `useMemo` or `useCallback`.
- **English Policy**: All codebase comments, JSDoc, identifiers, and types must be 100% English. Non-English text is strictly isolated to localized translation dictionary files (`site/src/locales/**` and `site/src/projects/<slug>/locales/**`). In pipelines, raw upstream source strings (e.g. scrapers/regex) are the sole exception.
- **Hygiene**: Never commit temporary files (`*.tmp`, `*.log`) or scratch scripts.

### 1.2 Code Documentation & Style
- **JSDoc Standards**: Use JSDoc `/** ... */` for exported symbols; never use `//`. Omit `@param` and `@returns` (TypeScript types are SSoT). Keep prop and field descriptions single-line with `@default` and explicit units (`USD`, `TWh`, `px`, `%)`.
- **Naming & Casing Conventions**:
  - `PascalCase`: Types, interfaces, and React components (`WarAttacksDataset`, `CatalogPage`, `Section`, `SectionChart`, `SectionBreakdown`).
  - `camelCase`: Variables, functions, object properties, and dataset schema fields (`totalMissiles`, `formatDecade`). Never use `snake_case`.
  - `SCREAMING_SNAKE_CASE`: Global constants and registries (`PROJECT_SLUGS`, `DEFAULT_LANGUAGE`, `SUPPORTED_LANGUAGE_CODES`).
  - `kebab-case`: File names (except `PascalCase.tsx` components/pages), directory names, URLs, slugs, and anchor IDs (`space-launches`, `chart-builder.ts`, `#uav-dynamics`).

### 1.3 Commit Hygiene & Changelog Protocol
- **Conventional Single-Line Commits**: Format: `<type>(<scope>): <summary>`. When a release milestone or version bump is introduced in the commit, the version tag MUST be the first token in the message: `v<version>: <type>(<scope>): <summary>` (e.g. `v1.2.0: feat(site): ...`). Never write multi-line commit messages.
- **Changelog SSoT (`CHANGELOG.md`)**: Release notes belong strictly in `CHANGELOG.md` adhering to [Keep a Changelog](https://keepachangelog.com/). Group by workspace (`### Tooling & Types`, `### Pipelines (@graphs/pipelines)`, `### Site (@graphs/site)`) and subsections (`#### Added`, `#### Changed`, `#### Removed`, `#### Fixed`).
- **Factorio / Plain Technical Changelog Style**: Write all changelog lines in the direct, action-oriented "Factorio / Wube" engineering style:
  - **Verb-First Pattern**: Every bullet MUST start with an active past-tense verb: `Added ...`, `Fixed that ...` / `Fixed ...`, `Changed ...`, `Removed ...`, `Renamed ...`, `Extracted ...`, `Optimized ...`.
  - **Zero Marketing Fluff**: Strictly ban buzzwords and hollow adjectives ("powerful", "revolutionary", "seamless", "enhanced user experience"). State purely what was added, changed, or fixed.
  - **Precise Identifiers**: Use exact symbols, functions, file names, and types in backticks (e.g. `Fixed that clicking anchor copy button updated browser URL instead of only copying to clipboard.`, `Added Ukrainian (uk) and German (de) localizations across UI and projects.`, `Extracted tags.css from global.css.`).
- **Package Versioning**: Workspace `package.json` files are private application packages and omit `"version"`. Semantic milestones exist exclusively in `CHANGELOG.md`.

---

## 2. End-to-End System Pipeline

```
[ Upstream Sources ] (Telegram, Kaggle, APIs)
        │
        ▼
[ pipelines/src/ ] ──── TypeScript ETL scrapers (cache-first, clean, audit, precompute)
        │
        ├─► [ site/src/data/*.json ] ──── Ephemeral compact datasets + metadata.json (gitignored)
        │
        ▼
[ types/ ] ──── SSoT Schemas & Slugs (@graphs/types workspace package)
        │
        ▼
[ site/ ] ──── React 19 + React Router v7 SSG (pre-rendering + ECharts)
```

**System Invariants**:
- Datasets in `site/src/data/*.json` and `site/src/data/metadata.json` are ephemeral build artifacts (gitignored). Pipelines never touch frontend templates; templates never execute scrapers.
- **Build Order**: `bun run build:site` requires datasets to exist. Run `bun run build:pipeline` before `bun run build:site` on a fresh clone (or run `bun run build`, which orchestrates both).
- **CI/CD (`.github/workflows/deploy.yml`)**: Runs weekly (Mon 03:00 UTC) or on push to `main`: executes pipelines, builds SSG site, and deploys directly to GitHub Pages.

---

## 3. Data Pipelines & ETL Lifecycle

- **CLI Commands**:
  - Run all: `bun run build:pipeline` (or `bun pipelines/src/run-all.ts`).
  - Run single: `bun --filter @graphs/pipelines <script>`.
  - Flags: `-u`, `--update` (force cache invalidation & re-download); `-v`, `--verbose` (debug traces & retry backoffs).
- **Universal Caching Policy**: Cache-first by default. Preserve historical data and fall back to local disk cache when offline. `-u` triggers upstream refetch. Automated CI runs execute without `-u`.
- **Data Pre-Computation**: Compute all domain aggregates, totals, averages, peaks, and timelines in ETL. The frontend only displays precomputed data without client-side calculation loops.
- **Storage & Schema Standards**:
  - Output static datasets to `site/src/data/<slug>.json` as compact single-line JSON strings (`writeJson(..., 0)`). Excluded from formatting in `biome.json`.
  - All properties must strictly use `camelCase` matching `@graphs/types` schemas to enable clean ES6 shorthand notation.
  - Timestamps belong in `metadata.json` via `updateMetadata('<slug>')`. Data sources belong in `site/src/projects/<slug>/meta.ts`. Datasets contain strictly pure data.
- **Shared Utilities (`pipelines/src/utils/`)**:
  - `http.ts`: `fetchWithRetry` with exponential backoff and timeouts.
  - `region.ts`: `resolveRegionCode` for ISO 3166-1 alpha-2 / UN code normalization.
  - `fs.ts`: `writeJson`, `readJson`, `ensureDir`, `fileExists`.
  - `logger.ts`: `getLogger('<tag>')` via `consola` (`.start()`, `.info()`, `.success()`, `.warn()`, `.error()`, `.debug()`).
  - `metadata.ts`: `updateMetadata('<slug>')`.
- **Constraint for `parse-ua.ts`**: Strictly prohibits any comments (`//`, `/* */`) or docstrings.

---

## 4. Frontend & Visualization Architecture

### 4.1 Structure & Registry
- **`site/src/pages/`**: Route entrypoints (`CatalogPage.tsx` overview homepage, `ProjectPage.tsx` universal dashboard shell, `ChangelogPage.tsx`, `NotFoundPage.tsx`).
- **`site/src/components/`**: Modular UI components:
  - `layout/`: `SiteLayout.tsx` (visual app shell with header, language dropdown, mobile menu, footer), `PageHeader.tsx`, `SectionNav.tsx`.
  - `sections/`: `Section.tsx` (polymorphic section container), `SectionChart.tsx` (ECharts visualization view), `SectionBreakdown.tsx` (side-by-side comparison grid).
  - `ui/`: Interactive controls (`Slider`, `ToggleGroup`, `FilterPills`), dropdowns and selectors (`DropdownMenu`, `SearchSelect`), drawers (`Sheet`), metrics (`KpiCard`), badges (`TagBadge`), `AnchorButton`, and `LoadingSpinner`.
  - `icons/`: Centralized SVG icon components (`LogoIcon`, `GithubIcon`, `ChevronDownIcon`, `MenuIcon`, `ClockIcon`, etc.).
- **`site/src/types/`**: Dashboard and visualization contracts (`section.ts` for section & control specs, `project.ts`, `tag.ts`, `index.ts`).
- **`site/src/projects/<slug>/`**: Self-contained vertical slices: `meta.ts` (SSoT for `id`, `tags`, `sources`), `project.ts` (spec spreading `...meta` and `buildSections`), and `locales/` (`meta-{lang}.ts` for catalog titles/descriptions; `dict-{lang}.ts` for chart labels/units across all supported languages: `en`, `ru`, `uk`, `de`).
- **`site/src/projects/registry.ts`**: Unified project domain façade discovering metadata, specifications, and localized dictionaries via Vite `import.meta.glob` with zero manual imports.

### 4.2 Polymorphic Section Contract (`DashboardSection`)
Dashboards render through discriminated union `DashboardSection = ChartSection | BreakdownGridSpec | CustomSection`:
- **`ChartSectionSpec` (`type: 'chart'`)**: Unified ECharts visualization spec extending `BaseSectionSpec` (`{ anchorId, title?, kpisTop?, kpisBottom?, controls?, buildView }`). Defined 100% via `chartSection({ ... })` for both static charts (no controls) and reactive dynamic charts (`Slider` / `ToggleGroup`), with automatic compile-time value type inference in `buildView(values)`. Rendered by `<SectionChart>`.
- **`BreakdownGridSpec` (`type: 'breakdown-grid'`)**: Side-by-side comparison grid extending `BaseSectionSpec` with accordion expansion and ratio badges. Rendered by `<SectionBreakdown>`.
- **`CustomSectionSpec` (`type: 'custom'`)**: Arbitrary custom React container extending `BaseSectionSpec` (`{ anchorId, title?, render }`). Defined via `customSection({ ... })` for specialized visualizers (e.g. MapLibre GL vector maps). Rendered by `<Section>` inside the unified card shell.
- **Anchor Invariant**: Every section MUST define an `anchorId`. Deep-linking (`#<anchorId>`) and scroll-spy hash updates are handled automatically by `<Section>` via native browser `scrollend`. Clicking the anchor copy button (`<AnchorButton>`) copies the link directly to clipboard without mutating browser navigation history or route URL.

### 4.3 Chart & Visualization Standards
- **Clean Y-Axis Invariant**:
  - **No Unit/Percent Formatters on Ticks**: Never attach currency symbols (`$`, `USD`), percent signs (`%`), or measurement units (`kg`, `t`) to individual Y-axis tick labels via `axisLabel.formatter`. ECharts handles clean numeric intervals automatically.
  - **Axis Title Invariant**: Units, currencies, and scale factors belong strictly in `yAxis.name` (e.g. `name: '%'`, `name: `${fmt.scale(1e9)} ($)``, `name: `${fmt.scale(1e12)} (Int$)``, `name: fmt.per('$', 'mass-kilogram')`, `name: t.common.units`, or `name: t.proj.units.*`).
  - **Mirrored / Balance Charts Exception**: `axisLabel.formatter` on Y-axes is permitted exclusively in diverging mirrored balance charts (e.g. imports vs exports or attacks vs interceptions) solely to strip the negative sign via `(v: number) => String(Math.abs(v))`.
- **Declarative Tooltips & `chartOption` (`@/utils/chart-builder`)**:
  - Zero raw HTML strings in tooltip formatters. Use `chartOption({ series, tooltip: { type: 'axis' | 'dual' | 'table', ... } })` where point metadata type (`data`) is automatically inferred from `series` with zero boilerplate.
  - Tooltip strategies: `'axis'` for multi-series category charts, `'dual'` for diverging/mirrored (positive vs negative) charts, and `'table'` for tabular breakdowns.
  - Features: auto-sorting (`sort: 'desc'`), semantic row indicators, pre-formatted values, and localized summary `footer` rows (`t.common.average`, totals, ratio preset).
- **Canvas Theme Auto-Enhancement (`enhanceOption`)**:
  - `<SectionChart>` automatically injects theme typography (`themeFonts.sansFamily`), dark-theme grid clearance for legends and controls, dark glassmorphic tooltips, series styling presets, and localized toolbox controls (`saveAsImage` with 2x pixel ratio, `restore` from `t.common`).
  - Project section builders only configure domain-specific series, axes, and declarative tooltips. Never manually configure canvas backgrounds, font families, or export toolbox actions.
- **Color Palette Standards**:
  - Country/region colors: resolved dynamically via `fmt.regionColor(code)`.
  - Semantic highlights: resolved via `resolveColor(semanticColor)` from `@/utils/color` or theme tokens from `tokens.ts`. Never hardcode raw hex values in project specifications.

### 4.4 Frontend Utilities Reference (`site/src/utils/`)
- **`format.ts`**: Centralized formatting factory `createFormat(lang, cldr)` returning pre-bound `fmt` helpers: `number`, `currency`, `percent`, `ratio`, `date`, `decade`, `scale` (`B`/`Млрд`, `T`/`Трлн`), `region`, `regionColor`, `unit` (CLDR pluralized units), `unitName`, and `per` (`$/kg`). CLDR datasets are loaded dynamically in root route loader.
- **`color.ts`**: Semantic color resolution utility (`resolveColor(color)`) mapping semantic palette keywords (`primary`, `success`, `warning`, `danger`, `info`, `blue`, `muted`), Tailwind classes, and hex codes to standardized theme hex values (for canvases) or CSS classes (for React components like `KpiCard`).
- **`chart-builder.ts`**: Unified ECharts visualization engine: canvas theme enhancement (`enhanceOption`), smart option builder with automatic point metadata inference (`chartOption`), responsive grid boundaries, typography, dark glassmorphic styling, columnar transposition (`zipRecords`), bar series builders (`createBarSeries`, `createStackTotalSeries`), and encapsulated declarative tooltip engine (`tooltipEngine`).
- **`locales.tsx`**: SSoT for language constants (`DEFAULT_LANGUAGE`, `SUPPORTED_LANGUAGE_CODES`), navigation helpers (`getLanguageFromPath`, `getLocalizedPath`), `LANGUAGE_MAP` with direct country flags, and React context (`LocaleProvider`, `useLanguage`, `useTranslation`, `useFormat`, `useCatalog`).
- **`version.ts`**: Exposes `SITE_VERSION` compiled at build time from root `CHANGELOG.md` via Vite define.

### 4.5 Shell, Routing & Loading Architecture
- **Two-Tier Layout Contract**:
  - **Document Shell (`root.tsx` -> `Layout`)**: Generates valid HTML document structure (`<html>`, `<head>`, fonts, `<Meta>`, `<Links>`, `<Scripts>`) for React Router v7 SSG pre-rendering and client hydration. Contains zero application UI.
  - **Application Shell (`SiteLayout.tsx` -> `SiteLayout`)**: Renders visual navigation shell (sticky `glass-bar` header with project links, changelog version pill, language dropdown with SVG flags, mobile drawer, `<main>` content container, and footer).
- **Two-Tier Dynamic Loading & Code-Splitting**:
  - **Tier 1 (Root Locale)**: `loadRootLocale(lang)` in `root.tsx` loads shared UI dictionary (`common-{lang}.ts`), CLDR unit formats (`data/cldr/{lang}.json`), and project catalog metadata (`getLocalizedCatalog`) into `<LocaleProvider>`.
  - **Tier 2 (Project Dashboard)**: `loadProjectBundle(slug, lang)` dynamically loads data JSON (`site/src/data/{slug}.json`), dashboard section builder (`projects/{slug}/project.ts`), and localized chart vocabulary (`locales/dict-{lang}.ts`) strictly on-demand via React 19 `use()`.
- **Pure TypeScript SSoT Localization**: Zero external localization dependencies or compilers. Reference dictionaries define type contracts (`typeof ...`), and all translations use strict TypeScript validation (`satisfies ...`) guaranteeing 100% key symmetry and autocomplete at compile time.
  - Shared dictionaries: `site/src/locales/common-{lang}.ts` (common UI terms, site header/footer labels, category tags across `en`, `ru`, `uk`, `de`).
  - Project metadata: `site/src/projects/<slug>/locales/meta-{lang}.ts` (lightweight catalog cards and navbar titles for all supported locales: `en`, `ru`, `uk`, `de`).
  - Project charts: `site/src/projects/<slug>/locales/dict-{lang}.ts` (series, axes, and tooltip labels loaded strictly on-demand for all supported locales).
- **Clean Localization Strings Invariant**: Translation dictionary values must contain pure text without trailing colons (`:`), exclamation marks (`!`), or structural punctuation. Punctuation and formatting belong strictly in UI templates/components at the call site or via `fmt` helpers.
- **Navigation & URLs (`routes.ts`)**: Default language (`en`) has no URL prefix (`/`, `/:slug`, `/changelog`). Non-default languages use prefix `/:lang/...` (e.g. `/ru`, `/uk`, `/de`). Language switching preserves query parameters and active scroll-spy hash.

### 4.6 Mandatory Path Aliases & Imports
- All files within `site/src/` must strictly use configured `@/*` path alias (`@/types`, `@/utils/*`, `@/components/*`, `@/styles/*`, `@/pages/*`, `@/projects/*`, `@/data/*`) rather than relative parent traversal (`../..`).
- Pipelines (`pipelines/src/**`) import shared schemas and slug definitions directly from workspace package `@graphs/types`.
- Node-evaluated files (`react-router.config.ts`, `src/routes.ts`, `scripts/**`) use relative file imports to avoid alias resolution issues before Vite plugins initialize.
- Never use wildcard imports (`import * as ...`). Keep imports explicit, named, and modular for optimal tree-shaking.

### 4.7 Design System & Modular Stylesheets (`site/src/styles/`)
Styles are organized into focused modular stylesheets imported by `global.css`:
- **`global.css`**: Base layers, theme variables (`@theme`), custom scrollbars, and container utility shortcuts (`glass-bar`, `glass-overlay`, `card`, `card-elevated`, `card-subtle`, `control-panel`, `btn-subtle`, `btn-accent`, `nav-pill`, `anchor-btn`).
- **`tags.css`**: Metadata tag pill utility (`@utility tag-pill`) with domain palette attribute selectors (`[data-tag]`).
- **`changelog.css`**: Markdown prose styles for release notes (`.changelog-markdown`).
- **`map.css`**: MapLibre GL dark glassmorphic popup styling matching chart tooltips.
- **`tokens.ts`**: TypeScript theme tokens (`themeColors`, `themeFonts`) for ECharts canvas options and React components.
- **Canonical Utility Invariant**: Never write ad-hoc combinations of `backdrop-blur`, fragmented background opacities (`/85`, `/70`), or redundant 15-class button/card strings inline in JSX when a standard shortcut exists. Always prefer standard Tailwind spacing/radius classes (`-ml-0.5`, `rounded-xs`, `min-h-8`, `min-w-40`, `min-w-50`, where any multiple of 4px $N$ maps to `w-${N/4}`) over arbitrary pixel brackets (`-ml-[2px]`, `rounded-[2px]`, `min-h-[32px]`, `min-w-[200px]`).

---

## 5. New Dashboard Registration Checklist

To register a new project/dashboard, follow this atomic 5-step checklist:

1. **Dataset Schema (`types/projects/<slug>.ts`)**: Define TypeScript interface (`*Dataset`) for the structured data.
2. **Slug Mapping (`types/projects/index.ts`)**: Add `<slug>` to `PROJECT_SLUGS` and `ProjectDataMap` (automatically drives `ProjectSlug`, SSG pre-rendering, and registry discovery).
3. **ETL Pipeline (`pipelines/src/<slug>/index.ts`)**: Implement scraper/parser outputting compact JSON to `site/src/data/<slug>.json` and calling `updateMetadata('<slug>')`.
4. **Pipeline Runner (`pipelines/src/run-all.ts` & `package.json`)**: Register task in `PIPELINES` registry and root/package scripts.
5. **Project Module (`site/src/projects/<slug>/`)**:
   - `meta.ts`: Export static metadata descriptor `export const meta: StaticProjectMeta<'<slug>'> = { id, tags, sources }`.
   - `locales/meta-{lang}.ts`: Export `meta` (`title`, `description`) validated with `satisfies` across ALL supported languages (`en`, `ru`, `uk`, `de`).
   - `locales/dict-{lang}.ts`: Export `dict` (series, titles, units) validated with `satisfies` across ALL supported languages (`en`, `ru`, `uk`, `de`).
   - `project.ts`: Implement and export specification `export const project: Project<'<slug>', typeof dict> = { ...meta, buildSections };`.
   *(Discovered dynamically via `registry.ts` — no page wrappers, catalog entries, or route registration required. All 4 languages are mandatory for SSG pre-rendering).*
