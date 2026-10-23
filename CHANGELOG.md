# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.2] - 2026-10-23

### Pipelines (@graphs/pipelines)

#### Fixed
- Fixed that UN Comtrade commercial services requests silently truncated at 100,000 rows by batching countries into groups of 40 (`BATCH_SIZE_SERVICES_COUNTRIES = 40`) and guarding against response overflow in `syncServicesStage`.

---

### Site (@graphs/site)

#### Added
- Added `useSectionResize` and `subscribeWindowResize` consolidating per-component `ResizeObserver` instances into a single global listener with viewport-aware deferred execution (`deferUntilInView`), pausing canvas and layout recalculations while sections are scrolled off-screen.
- Added `SectionHeader.tsx` unifying responsive 3-column title centering, anchor buttons, and automatic row transfer with centered anchor button when section titles exceed available single-row card width.

#### Changed
- Streamlined site header on mobile viewports by hiding the brand group in favor of dedicated burger navigation and full-width section outline pills, simplifying `BrandGroup` component props down to `compact` and `className`.

#### Fixed
- Fixed that wrapping toolbar controls shifted secondary rows to the left by switching compact control layout to line-scoped float clearance, allowing row 1 to reserve Reset button space while subsequent rows expand across 100% card width.
- Fixed that multi-row chart legends overlapped grid series on dynamic filter updates by applying horizontal clearance padding before calculating vertical multi-row wrapping height.
- Fixed that multi-row chart legends and toolbox export icons drifted out of horizontal alignment with the Y-axis title label by computing container-width fluid typography in pass 1 to scale legend markers and toolbox buttons, anchoring row 1 or the bottom row along the exact axis baseline in pass 2.
- Fixed that bar series inside labels rendered with an unstyled 10px fallback font on iOS Safari (WebKit) when overflowing narrow bars by replacing `fontSize: 0` with off-screen positioning `{ x: -9999, y: -9999 }`.
- Fixed that interactive control stores retained non-default filter state in memory across page navigations without reflecting it in the URL by clearing `storeRegistry` and active debounce timers upon `ProjectDashboard` unmount.
- Fixed that map and section loading overlays overlapped sticky dashboard toolbars during scroll flight by raising `DashboardToolbars` and `SearchSelect` dropdowns to `z-40` while bounding in-card loaders to `z-20`.
- Fixed that `TimelineScrubber` date pickers overflowed the screen on narrow viewports by grouping them into a unified wrapping flexbox, naturally stacking them with aligned widths when constrained while maintaining vertical centering of the Reset button.

---

## [1.3.1] - 2026-10-22

### Tooling & Shared (@graphs/shared)

#### Added
- Added `@graphs/shared` workspace package consolidating cross-package data schemas (`@graphs/shared/types/*`) and mathematical utilities (`@graphs/shared/math`), migrating all imports from `@graphs/types/*`.

#### Changed
- Changed `TradeCategoryId` to compact 2-letter codes across all 17 goods and services classifications (e.g. `mc`, `ch`, `tx`), cutting URL query parameter lengths by ~80%.

#### Removed
- Removed legacy root `types/` workspace directory.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added bilateral partner-category cross-filtering and in-memory symmetrical mirror import reconstruction in `pipelines/src/country/index.ts`.
- Added unified `PipelineLogger` across all ETL pipelines with standardized stage tracking and progress reporting.
- Migrated all pipeline baseline data snapshots to committed minimal Brotli-compressed files (`.json.br`).

#### Changed
- Stripped precalculated percentage shares from Country profile L2 datasets, storing pure numbers and cutting payload sizes by ~35–48%.

#### Fixed
- Fixed that Country toolbar metadata `minYear` and `maxYear` boundaries included multi-year IMF WEO future forecasts, bounding them to production timeline ranges.

#### Removed
- Removed uncompressed raw `data.json` and intermediate snapshot files from `pipelines/src/*/` in favor of Brotli `.json.br` baselines.

---

### Site (@graphs/site)

#### Added
- Added bilateral commodity and trading partner cross-filtering with multi-search selection, hierarchy toggling (`macro` / `detailed`), and dynamic client-side trade share percentage computation in Country foreign trade charts.
- Added `CHART_CONFIG` architecture with fluid typography scaling, frame-budgeted canvas updates (`queueChartRender`), and off-screen render suppression coordinated with real-time viewport intersection tracking.
- Added debounced control scrubbing (`CONTROL_DELAYS`), functional control evaluation, `onChange` atomic state mutations, and namespaced URL query parameter synchronization (`urlPrefix`) across dashboard toolbars.
- Added standardized micro-typography (`--text-2xs`, `--text-3xs`) and viewport scales (`--height-chart: 60dvh`) to `@theme` in `site/src/styles/global.css`, and aligned Changelog outline dates via CSS Subgrid.

#### Fixed
- Fixed that Country trade partner percentage shares normalized against selected partners rather than total market basket volume, causing single-partner selections to collapse to 100%.
- Fixed dynamic Y-axis percentage headroom calculations and timeline boundary clamping in Country foreign trade sections.
- Fixed dark-mode WCAG AA contrast compliance across interactive controls (`Checkbox`, `TimelineScrubber`, text selection).
- Fixed that `useTranslation` and `useFormat` in `site/src/utils/provider.tsx` threw unhandled runtime exceptions when rendered outside `AppProvider`, providing resilient default fallbacks for SSR and error boundaries.

---

## [1.3.0] - 2026-10-21

### Tooling & Types

#### Added
- Added `@graphs/types/country` schema definitions exporting `CountryProfileData`, `CountryToolbarMeta`, `CountryCategoryTuple`, and trade classification constants.
- Added unified dataset and toolbar metadata schemas across all project dashboards.

#### Changed
- Consolidated project type exports into unified subpath entry points `@graphs/types/<slug>` (`./*/index.ts`) in `types/package.json`.
- Relocated project metadata to ephemeral `site/public/data/metadata.json` and gitignored pre-rendered OpenGraph assets in `site/public/og/`.

#### Removed
- Removed scattered per-section type declaration files and legacy frontend contract definitions in favor of `@graphs/types/<slug>` schemas.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `country` ETL pipeline in `pipelines/src/country/index.ts` processing UN Comtrade merchandise, commercial services, and IMF WEO indicators across 192 sovereign nations with rate-limited pacer queues and incremental checksum caching.
- Added `computeMacroGrowthData` in `pipelines/src/ukraine/index.ts` precomputing annual YoY % growth dynamics across GDP, revenue, expenditures, and external debt.
- Added `exportProjectMeta` and `exportDataset` in `pipelines/src/utils/dataset.ts` for unified project-level dataset and toolbar metadata exports.

#### Changed
- Renamed exported section datasets: `budget-and-debt` to `macro`, `equipment-breakdown` to `losses-breakdown`, `missile-strikes` to `strikes-missile`, and `uav-strikes` to `strikes-uav`.
- Extended `war-rf-ua` frontline dynamics with pre-invasion territorial baseline (`2022-02-23`) and precomputed monthly category matrices in `toolbar-meta.json`.

#### Fixed
- Fixed that `fetchWithRetry` repeatedly retried on exhausted API quotas, adding `HttpError` with immediate termination on HTTP 401/403 and `Retry-After` header parsing.

---

### Site (@graphs/site)

#### Added
- Added `country` dashboard slice in `site/src/projects/country/` with `#macro`, `#macro-growth`, `#trade-structure`, `#trade-categories`, and `#trade-partners` sections across 4 locales.
- Added `#macro-growth` section in `site/src/projects/ukraine/sections/macro-growth.ts` rendering YoY growth rates and annual increments for budget and debt indicators.
- Added coordinated dashboard toolbar architecture (`site/src/components/ui/ControlBar.tsx`) supporting shared filtering across multiple sections with reactive store binding (`site/src/utils/store.ts`).
- Added polymorphic `SearchSelect` component supporting single/multi-selection modes and `TimelineScrubber` component with calendar date picker.

#### Changed
- Consolidated `useInView` and `useScrollSpy` into unified `site/src/utils/viewport.ts` module with coordinated intersection observation and programmatic scroll locking during navigation.
- Standardized uniform section contract in `defineSection`, unifying polymorphic `buildView` views across charts, grids, and maps.
- Restructured `war-rf-ua` dashboard into synchronized sections linked to coordinated timeline scrubber and category filters.
- Streamlined `SectionChart.tsx` to rely on container `ResizeObserver` with `requestAnimationFrame` debouncing and smooth opacity cross-fade on initial mount.

#### Fixed
- Fixed that `generate:og` preview images captured sticky dashboard toolbars, section control bars, anchor buttons, and deep-link scroll offsets.
- Fixed that `formatDate` in `site/src/utils/format.ts` shifted calendar days due to UTC timezone offsets when parsing ISO date strings.
- Fixed that `exportChartAsPng` in `site/src/utils/chart-builder.ts` clipped line series `endLabel` indicators by invoking `adjustChartLayout` prior to canvas export.
---

## [1.2.4] - 2026-10-13

### Tooling & Types

#### Added
- Added `yearLabels` and debt breakdown fields (`govDebt`, `privateDebt`) to Ukraine schemas.

---

### Pipelines (@graphs/pipelines)

#### Added
- Extracted fallback LEO capacities and historical launch costs for ~115 rocket configurations, increasing space launch cost coverage from 31.0% to 94.4%.
- Added partial-year trade ingestion and sovereign/private external debt breakdown parsing from NBU workbooks.
- Added IT computer services and commercial services trade parsing by partner nation in Ukraine pipeline.

#### Changed
- Removed redundant launch properties from `StoredLaunch` and aligned Ukraine foreign trade totals directly with balance of payments figures.

---

### Site (@graphs/site)

#### Added
- Added reactive filter coordination between `#losses-map` and `#equipment-breakdown`, dynamically filtering model cards when map filters are active.
- Updated `#trade-structure` X-axis to render dynamic `yearLabels` (e.g. `2026 (8m)`), supporting partial-year periods alongside annual historical data.
- Added stacked sovereign (`govDebt`) and private (`privateDebt`) debt series with top total labels to `#budget-and-debt`.
- Added global trend lines across `#launch-costs`, `#avg-payload`, and `#failure-rates` charts.

#### Changed
- Refactored chart tooltip engine to pure functional generators directly invoking `tooltip-builder` primitives.
- Synchronized browser document title resolution during scrolling with localized section names from metadata dictionaries.

#### Fixed
- Fixed that "All categories" count in `#losses-map` collapsed to the selected category count instead of remaining the sum of all matching categories.
- Fixed that tall chart tooltips were clipped vertically by canvas container boundaries by removing `overflow: hidden` from `SectionChart`.

---

## [1.2.3] - 2026-10-09

### Tooling & Types

#### Changed
- Relocated dataset metadata to `site/src/data/metadata.json`.

---

### Pipelines (@graphs/pipelines)

#### Changed
- Updated pipeline path utilities to write `metadata.json` into `site/src/data/metadata.json`.

---

### Site (@graphs/site)

#### Added
- Added `SectionHeader.tsx` unifying responsive 3-column title centering, anchor buttons, and action control stacks across all card layouts.
- Added `exportChartAsPng` rendering 2400×1120 Retina PNG charts with centered titles and solid card backgrounds via offscreen canvas.
- Added automated OpenGraph snapshot generator (`generate-og.ts`) capturing 2400×1260 preview images for all dashboard sections.
- Added automatic code-splitting with `React.lazy()` for heavy client visualizers (`SectionChart`, `FrontlineMap`, `LossesMap`).

#### Fixed
- Fixed that deep-linking to bottom sections triggered scroll jumping or blank upper sections when scrolling up.
- Fixed document-level horizontal scrollbars on narrow viewports by applying layout containment to chart wrappers.

---

## [1.2.2] - 2026-10-08

### Tooling & Types

#### Added
- Added `types/war-rf-ua/` schemas covering frontline map, territorial dynamics, equipment losses, and air attack sections with subpath exports (`./*`).

#### Removed
- Removed monolithic barrel `index.ts` files across `@graphs/types` in favor of direct subpath imports.
- Removed static `PROJECT_SLUGS` constant array in favor of dynamic project discovery.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `pipelines/src/war-rf-ua/parse-frontline.ts` calculating consensus territorial control, disputed zones, and polygon clipping (`polygon-clipping`).
- Added standalone section dataset exporter `exportProjectSections` outputting compact per-section JSON files to `site/public/data/<slug>/<sectionId>/data.json`.

#### Changed
- Consolidated `war-rf-ua-losses` and `war-rf-ua-attacks` into a single unified `pipelines/src/war-rf-ua/` pipeline.
- Refactored all pipelines to export per-section datasets directly.
- Optimized `parse-attacks-ua.ts` to perform incremental Telegram crawling from `lastPostId + 1`.

---

### Site (@graphs/site)

#### Added
- Added `FrontlineMap.tsx` component and `#frontline-map` section rendering MapLibre GL vector multi-polygons for territorial control, contested zones, and frontlines.
- Added `#frontline-dynamics` section visualizing monthly net territorial changes, control area, and percentage share with interactive period slider.
- Added lazy per-section dataset loading (`loadSectionData`) using React 19 `use()` and `useInView` on viewport approach.
- Added 3-state theme mode (`system`, `light`, `dark`) with `AppProvider` context, header toggle, pre-hydration script, and light palette tokens across Tailwind CSS v4, ECharts, and vector map tiles.
- Added version subpaths in changelog routing (`/changelog/:version` and `/:lang/changelog/:version`) with multi-locale static SSG pre-rendering.
- Extracted shared visualization utilities `site/src/utils/tooltip-builder.ts` and `site/src/utils/map-builder.ts`.

#### Changed
- Consolidated `war-rf-ua-losses` and `war-rf-ua-attacks` into unified `war-rf-ua` dashboard.
- Decoupled `ResizeObserver` lifecycle in `SectionChart.tsx` to pause canvas calculations when scrolled off-screen.
- Refactored `useScrollSpy` into a domain-agnostic navigation contract standardizing on `[data-section]`.

#### Removed
- Removed monolithic project dataset preloading from `loadProjectBundle` in favor of on-demand section loading.

#### Fixed
- Fixed that transitioning between bar and line chart series in `SectionChart.tsx` left lingering series and ghost tooltips by setting `notMerge: true` in `chart.setOption`.
- Fixed that language synchronization in `AppProvider` redirected direct localized deep links to the stored browser language.

---

## [1.2.1] - 2026-10-05

### Tooling & Types

#### Added
- Added commodity trade schemas and `SectionBuilder` / `StaticProjectMeta` contract definitions to `@graphs/types`.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added committed minimal data snapshots (`pipelines/src/<slug>/data.json`) across all pipelines, establishing a deterministic two-tier data architecture without disk caches.
- Added commodity category trade dynamics extraction across 8 NBU commodity groups from `Trade_y.xlsx` in `ukraine` pipeline.
- Added HTTP HEAD pre-flight metadata verification (`fetchHeadMeta`) to skip redundant downloads when upstream ETags or release timestamps are unchanged.

#### Changed
- Changed ETL pipelines to ingest and sanitize upstream source data purely in memory, stripping unused SVG coordinates, KML XML overhead, and redundant launch metadata.
- Migrated `war-rf-ua-attacks` from full-text Telegram dump to compact pre-parsed report snapshots (`data-ua.json` and `data-rf.json`), enabling instant offline builds and incremental crawling.

#### Removed
- Removed legacy `cache/` directories, intermediate JSON offset dumps, and temporary disk cache files across all pipelines.

#### Fixed
- Fixed that historical NBU USD/UAH exchange rates prior to 2021 were 100x overstated by dividing quote rates by unit scale (`rate_per_unit`).

---

### Site (@graphs/site)

#### Added
- Added clean path-based routing (`/:slug/:section` and localized `/:lang/:slug/:section`) with multi-locale static SSG pre-rendering and dynamic page title synchronization.
- Added `Checkbox` component and `RangeSliderControl` (`'range-slider'`) for dual-handle period filtering.
- Added `#trade-categories` diverging stacked bar chart to Ukraine dashboard tracking foreign trade across 8 commodity groups with absolute and percentage modes.
- Added dynamic chart layout engine (`adjustChartLayout`) in `SectionChart.tsx` resolving legend wrapping, Y-axis label clearance, and toolbox alignment via runtime ECharts model inspection.
- Extracted isolated modular section builders (`sections/<section-id>.ts`) across all dashboards, loaded dynamically via `import.meta.glob`.

#### Changed
- Refactored `SectionNav`, `AnchorButton`, and `useScrollSpy` to synchronize canonical section paths on scroll and provide isolated scroll tracking.

#### Fixed
- Fixed that multi-line legends and `AnchorButton` collided with `yAxis.name` and data grid by dynamically constraining legend bounds and container top offset.
- Fixed that Y-axis on Ukraine `budget-and-debt` chart dropped below zero on historical intervals by clamping net borrowing to non-negative values and setting `yAxis.min: 0`.
- Fixed that chart canvas became blurry on browser zoom or display scale changes by tracking dynamic `devicePixelRatio` and re-allocating canvas backing stores.
- Fixed that scrolling and section navigation stripped the router basename (`/graphs`) from browser URLs by distinguishing app-relative routes (`getPath`) from browser-level URLs (`getHref`).

---

## [1.2.0] - 2026-10-04

### Tooling & Types

#### Added
- Extracted shared domain schemas and project slug definitions into dedicated `@graphs/types` workspace package (`types/package.json`).
- Added analytical schemas for `ai-tokens`, `space-launches`, `ukraine`, `world`, and `war-rf-ua-losses`.

#### Changed
- Restructured `types/` into modular `types/projects/` directory matching project slugs and unified `ChartSectionSpec` with typed `buildView`.
- Removed explicit `"version"` fields from workspace `package.json` files, managing release versions exclusively via `CHANGELOG.md`.

#### Removed
- Removed obsolete legacy type definitions (`types/echarts.ts`, `types/projects.ts`, `StaticChartSpec`, `DynamicChartSpec`).

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `ai-tokens` ETL pipeline (`pipelines/src/ai-tokens/index.ts`) scraping time-series data from `tokensperday.com` with local cache fallback and macro-region/provider aggregation.
- Added precomputation of global annual and decade metrics in `space-launches` ETL pipeline (launch costs, average payload mass, failure rates).
- Added heuristic date parsing and MapLibre geospatial loss extraction (`lng`, `lat`, `posts`, `sources`) to `war-rf-ua-losses` pipeline.

#### Changed
- Overhauled `war-rf-ua-losses` dataset output to pure columnar arrays (`rf`, `ua`, `breakdowns`) and canonical 8-category equipment classifications, reducing JSON artifact size by 42%.
- Standardized schema properties on camelCase and pre-computed economic ratios across `ukraine` and `world` pipelines.

#### Fixed
- Fixed trade volume calculation and sovereign partner sorting in `ukraine` pipeline.
- Fixed handling of unclassified and ambiguous equipment entries in `war-rf-ua-losses` parser.

---

### Site (@graphs/site)

#### Added
- Migrated site from Astro to React Router v7 static site generation (SSG) with multi-locale static pre-rendering across all routes (`root.tsx`, `SiteLayout.tsx`, `routes.ts`, `react-router.config.ts`).
- Upgraded styling toolchain to Tailwind CSS v4 using CSS-first `@theme` design tokens and `@utility` shortcuts in `global.css`.
- Added Ukrainian (`uk`) and German (`de`) localizations across common UI dictionaries, all dashboard modules, and Unicode CLDR datasets with build-time CLDR unit extraction.
- Added `ai-tokens` dashboard tracking daily AI inference throughput by macro-region and model provider with absolute volume and market share toggle modes.
- Added interactive MapLibre GL vector map (`LossesMap.tsx`) in `war-rf-ua-losses` visualizing geolocated equipment losses with dynamic clustering and event popups.
- Added average payload mass per launch and nation reliability failure rate charts to `space-launches` dashboard.
- Added declarative `chartOption` smart visualization builder and tooltip engine (`tooltipEngine`) in `chart-builder.ts` with `axis`, `dual`, and `table` modes, automatic descending sorting, and semantic color indicators.
- Added polymorphic `SectionBreakdown` component rendering side-by-side comparison grids with ratio badges and accordion breakdown items.
- Added standalone styled 404 page (`NotFoundPage.tsx`) pre-rendered at `/404` and localized `/:lang/404` routes.
- Added focused React hooks (`useLanguage`, `useTranslation`, `useFormat`, `useCatalog`) and universal semantic color resolution utility (`color.ts`).
- Added two-tier dynamic code-splitting: root locale preloading in `root.tsx` and project bundle loading via React 19 `use(loadProjectBundle)` in `ProjectPage.tsx`.

#### Changed
- Migrated 100% of dashboard chart sections across all projects to `chartSection` and `chartOption`.
- Migrated dashboards to progressive chart rendering, allowing page headers, descriptions, tags, and KPI metric cards to render immediately without waiting for ECharts canvases.
- Split project localization slices into lightweight catalog metadata (`meta-{lang}.ts`) and on-demand chart dictionaries (`dict-{lang}.ts`).
- Migrated changelog rendering to on-demand chunk loading via React 19 `use(loadChangelog())`, code-splitting `marked`.
- Localized Y-axis measurement and currency units across dashboards (`fmt.per`, `fmt.scale`), replacing hardcoded English strings.

#### Removed
- Removed Astro toolchain, `.astro` pages, layouts, and components (`astro.config.mjs`, `Layout.astro`, `CatalogGrid.tsx`, `EChart.tsx`, `ChartCard.tsx`, `ViewToggle.tsx`).
- Removed `tailwind.config.mjs` in favor of Tailwind v4 CSS `@theme` configuration.
- Removed legacy imperative tooltip helpers and deleted `site/src/utils/tooltip.ts`.

#### Fixed
- Fixed that clicking anchor copy button updated browser URL and history instead of only copying to clipboard.
- Fixed that deep links to sections were partially covered by sticky header by attaching anchor IDs to top-level section containers with scroll margins.
- Fixed that language switching dropped active scroll-spy hash and URL query parameters.
- Fixed that unknown routes redirected to catalog homepage instead of displaying the 404 page.
- Fixed that static assets and stylesheet links were missing repository subpath prefix on GitHub Pages.
- Fixed that date range filter in `war-rf-ua-losses` map included undated points by strictly filtering out points without dates.

---

## [1.1.0] - 2026-09-24

### Tooling & Types

#### Added
- Converted repository to a Bun workspaces monorepo managing `@graphs/site` and `@graphs/pipelines` with native `bun.lock`.
- Integrated Biome toolchain (`biome.json`) for linting, formatting, and import sorting.
- Added centralized domain schemas in `types/` mapped via `@/types` path alias (`space-launches`, `ua-economic`, `war-rf-ua-attacks`, `war-rf-ua-losses`, `world-economic`).

#### Changed
- Reconfigured GitHub Actions CI/CD (`.github/workflows/deploy.yml`) to use `oven-sh/setup-bun@v2`, pipeline snapshot caching, and direct deployment to GitHub Pages.

#### Removed
- Removed legacy npm dependencies, `site/package-lock.json`, `tsx`, `vitest`, ESLint, and Prettier configurations.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added native TypeScript ETL pipelines running on Bun:
  - `space-launches`: Launch Library 2 API client with base snapshot cache merging and orbital payload / launch cost analytics.
  - `world-economic`: Ingestion of DBnomics (World Bank WDI, IMF WEO), OWID Energy, and UN Comtrade API with API key authentication and rate limiting.
  - `ua-economic`: Excel processing with SheetJS (`xlsx`) and NBU exchange rate APIs for state budget, debt, and trade dynamics.
  - `war-rf-ua-losses`: Verified equipment loss parser using `fast-xml-parser` and Google My Maps KML data with 8 weapon classifications.
  - `war-rf-ua-attacks`: Kaggle REST API downloader for RF attack data and high-concurrency Telegram MoD bulletin parser for UA interceptions.
- Added parallel pipeline runner in `pipelines/src/run-all.ts` using `Promise.allSettled` and scoped `consola` loggers.
- Added resilient HTTP client in `pipelines/src/utils/http.ts` with exponential backoff retries on HTTP 429 and 5xx responses.

#### Changed
- Replaced all legacy Python scrapers (`pandas`, `beautifulsoup4`, `openpyxl`, `kagglehub`) with native TypeScript crawlers running on Bun.
- Excluded static datasets in `site/src/data/*.json` and `metadata.json` from Git tracking, retaining only cold-start base snapshot caches in `pipelines/**/cache/`.

#### Removed
- Removed all Python ETL scripts (`pipelines/run_all.py`, `pipelines/**/*.py`).
- Removed `requirements.txt` and Python virtual environment files.

#### Fixed
- Fixed upstream API failures and rate limiting by adding exponential backoff retry handling to external HTTP requests.

---

### Site (@graphs/site)

#### Added
- Added modular React chart components in `site/src/components/graphs/` with automatic container resizing and dark theme styling presets.
- Added interactive multi-tag filtering on the catalog page (`CatalogGrid.tsx`).
- Added `EChart.tsx` React component wrapper with `ResizeObserver`, automatic theme injection (`enhanceOption`), and 2x PNG export toolbox.
- Added `ChartCard.tsx` container component with backdrop blur styling and direct URL anchor clipboard copying.
- Added `ViewToggle.tsx` segmented toggle control component for switching granularity and data dimensions.
- Added `KpiCard.tsx` React component for metric summary cards.
- Added standardized tooltip HTML builders in `site/src/utils/tooltip.ts`.
- Added scroll spy navigation in `Layout.astro` using `IntersectionObserver` with smooth scrolling to `[data-anchor-section]`.

#### Changed
- Converted `tokens.js` to strictly typed `tokens.ts` defining semantic color palettes and `CHART_BASE_THEME`.
- Converted all dashboard pages (`space-launches.astro`, `ua-economic.astro`, `war-rf-ua-attacks.astro`, `war-rf-ua-losses.astro`, `world-economic.astro`) to render React chart components with `client:load`.
- Updated `Layout.astro` to accept project metadata and render `PageHeader` automatically.

#### Removed
- Removed inline vanilla JavaScript `<script>` tags for ECharts initialization across all dashboard pages.
- Removed legacy vanilla JavaScript tag filter script and DOM manipulation routines from `index.astro`.
- Removed string-based tooltip formatter registry `site/src/charts/formatters.ts`.
- Removed legacy Astro components `ChartCard.astro`, `EChart.astro`, and `KpiCard.astro`.

#### Fixed
- Fixed Chromium scrollbar jitter and layout thrashing by replacing unthrottled window scroll listeners with debounced `scrollend` state updates.
- Fixed chart overflow and sizing errors during window resize by tracking chart container dimensions with `ResizeObserver`.

---

## [1.0.0] - 2026-09-23

### Tooling & Types

#### Added
- Added initial GitHub Actions workflow (`.github/workflows/deploy.yml`) for weekly automated pipeline execution and static deployment to GitHub Pages.
- Added Astro and Tailwind CSS build setup in `site/package.json`, `site/astro.config.mjs`, and `site/tailwind.config.mjs`.
- Added TypeScript configuration and project interfaces in `site/tsconfig.json` and `site/src/data/projects.ts`.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `pipelines/run_all.py` runner executing data pipelines sequentially with `-u`/`--update` flag support and `metadata.json` generation.
- Added `space_launches.py` ETL pipeline fetching launch records from Launch Library 2 API and computing yearly payload mass and decade costs per kg.
- Added `ua_economic.py` ETL pipeline downloading NBU macro spreadsheets and exchange rates API to calculate fiscal balance, debt ratios, and bilateral trade.
- Added `world_economic.py` ETL pipeline fetching data via DBnomics API (World Bank, IMF), UN Comtrade API, and OWID Energy to aggregate macroeconomic and industrial capacity metrics.
- Added `war_rf_ua_attacks.py` ETL pipeline downloading missile attacks datasets and aggregating monthly strike UAV and missile statistics.
- Added `war_rf_ua-losses.py` ETL pipeline downloading Google My Maps KML data and classifying verified equipment losses across 8 weapon categories.

---

### Site (@graphs/site)

#### Added
- Added overview catalog page (`index.astro`) with tag-based filtering and project metadata cards.
- Added `space-launches` dashboard tracking annual orbital payload capacity to LEO/SSO (1958–2026) and launch costs per kg by decade.
- Added `ua-economic` dashboard tracking Ukraine state budget execution, defense vs non-defense spending, domestic revenues, external debt, and foreign trade structure.
- Added `world-economic` dashboard comparing 8 major economies across real GDP (PPP), capital goods machinery turnover, electricity generation, manufacturing value added, and clean energy.
- Added `war-rf-ua-attacks` dashboard tracking monthly strike UAV and missile launches (ballistic vs cruise) with summary KPI metric cards.
- Added `war-rf-ua-losses` dashboard tracking visually confirmed heavy combat equipment losses across 8 weapon categories, monthly timelines, and expandable model breakdown cards.
- Added `EChart.astro` component integrating Apache ECharts with dark theme presets, auto-resize via `ResizeObserver`, and client-side formatter hydration.
- Added reusable UI components (`Layout.astro`, `PageHeader.astro`, `ChartCard.astro`, `KpiCard.astro`, `TagBadge.astro`) and design tokens (`tokens.js`).
