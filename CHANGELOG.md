# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2026-10-09

### Tooling & Types

#### Changed
- Relocated dataset metadata to `site/src/data/metadata.json` and configured `@data/*` path alias in `site/tsconfig.json` and `site/vite.config.ts`.
- Updated GitHub Actions deployment workflow to build and deploy static artifacts using Bun.

---

### Pipelines (@graphs/pipelines)

#### Changed
- Updated pipeline path utilities to write `metadata.json` into `site/src/data/metadata.json`.

---

### Site (@graphs/site)

#### Added
- Added `SectionHeader.tsx` unifying responsive 3-column title centering, anchor buttons, and action control stacks across all charts, maps, breakdown grids, and loaders.
- Added `exportChartAsPng` rendering 2400×1120 Retina PNG charts with centered titles and solid card backgrounds via offscreen canvas.
- Added automated OpenGraph snapshot generator (`generate-og.ts`) capturing pixel-perfect 1.91:1 (2400×1260 @2x) preview images for all project dashboard sections.
- Added localized `og:site_name` meta tags across all routes (`Graphs`, `Графики`, `Графіки`, `Graphen`).
- Added automated social metadata test suite (`validate-meta.test.ts`) validating OpenGraph tags, title/description character limits, and image 1.91:1 aspect ratios.
- Added automatic code-splitting with `React.lazy()` for heavy client visualizers (`SectionChart`, `FrontlineMap`, `LossesMap`).

#### Changed
- Condensed project descriptions across all four locales (`en`, `ru`, `uk`, `de`) to 108–140 characters to prevent truncation in search engines and mobile social cards.
- Synchronized section page titles to use concise titles from `projMeta` and section descriptions to use full section titles.
- Configured absolute canonical URL resolution (`SITE_ORIGIN`) for OpenGraph and Twitter card image tags across project dashboard routes.

#### Fixed
- Fixed that deep-linking to bottom sections triggered scroll jumping or blank upper sections when scrolling up.
- Fixed document-level horizontal scrollbars on narrow viewports by applying layout containment (`min-w-0`, `overflow-hidden`) to chart wrappers.
- Fixed that ECharts canvas failed to reactively update on formatter and label toggle changes in `SectionChart`.

---

## [1.2.2] - 2026-10-08

### Tooling & Types

#### Added
- Added `types/war-rf-ua/` schemas covering frontline map, territorial dynamics, equipment losses, and air attack sections.
- Added subpath wildcard exports in `types/package.json` (`./*`) mapping to modular per-project schemas.

#### Removed
- Removed monolithic barrel `index.ts` files across `@graphs/types` in favor of direct subpath imports.
- Removed static `PROJECT_SLUGS` constant array and `ProjectSlug` type union in favor of dynamic project discovery.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `pipelines/src/war-rf-ua/parse-frontline.ts` calculating consensus territorial control, disputed zones, and polygon boolean clipping (`polygon-clipping`) with committed snapshot `data-frontline.json`.
- Added standalone section dataset exporter `exportProjectSections` outputting compact per-section JSON files to `site/public/data/<slug>/<sectionId>/data.json`.

#### Changed
- Consolidated `war-rf-ua-losses` and `war-rf-ua-attacks` into a single unified `pipelines/src/war-rf-ua/` pipeline.
- Refactored all pipelines (`ai-tokens`, `space-launches`, `ukraine`, `world`, `war-rf-ua`) to export per-section datasets directly.
- Optimized `parse-attacks-ua.ts` to perform incremental Telegram crawling from `lastPostId + 1` instead of querying historic posts.

---

### Site (@graphs/site)

#### Added
- Added `FrontlineMap.tsx` component and `#frontline-map` section rendering MapLibre GL vector multi-polygons for consensus control, contested zones, and frontlines.
- Added `#frontline-dynamics` section visualizing monthly net territorial changes, control area, and percentage share with interactive period slider.
- Added lazy per-section dataset loading (`loadSectionData`) using React 19 `use()` and `useInView`, mounting charts and loading JSON on viewport approach (`rootMargin: '400px 0px'`).
- Added 3-state theme mode (`system`, `light`, `dark`) with `AppProvider` context, header toggle button, pre-hydration script eliminating FOUT, and light palette tokens across Tailwind CSS v4, ECharts, and vector map tiles.
- Added version subpaths in changelog routing (`/changelog/:version` and `/:lang/changelog/:version`) with multi-locale static SSG pre-rendering.
- Added granular per-section data source links across all card headers and footers.
- Extracted `site/src/utils/tooltip-builder.ts` consolidating pure HTML tooltip rendering shared across ECharts and MapLibre GL popups.
- Extracted `site/src/utils/map-builder.ts` standardizing MapLibre GL vector tile styling, bounds presets, and layer factories.

#### Changed
- Consolidated `war-rf-ua-losses` and `war-rf-ua-attacks` into unified `war-rf-ua` dashboard.
- Decoupled `ResizeObserver` lifecycle in `SectionChart.tsx` to pause canvas calculations when scrolled off-screen.
- Refactored `useScrollSpy` into a domain-agnostic navigation contract standardizing on `[data-section]`.

#### Removed
- Removed monolithic project dataset preloading from `loadProjectBundle` in favor of on-demand section loading.
- Removed obsolete single-use map wrappers and static color variables from `global.css`.

#### Fixed
- Fixed that transitioning between bar and line chart series in `SectionChart.tsx` left lingering series and ghost tooltips by setting `notMerge: true` in `chart.setOption`.
- Fixed that language synchronization in `AppProvider` redirected direct localized deep links to the stored browser language.
- Fixed that legend wrapping pushed the toolbox downward into the chart canvas by anchoring toolbox top to baseline grid metrics.
- Fixed that changelog release headings emitted `data-anchor-section` instead of `data-section`, leaving outline navigation inactive.

---

## [1.2.1] - 2026-10-05

### Tooling & Types

#### Added
- Added `TRADE_CATEGORY_IDS`, `TradeCategoryId`, and `TradeCategoryTuple` types to `@graphs/types` for Ukraine commodity trade series.
- Added `SectionBuilder` and canonical `sections` list contract to `StaticProjectMeta` in `@/types`.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added committed minimal data snapshots (`pipelines/src/<slug>/data.json`, and `data-ua.json` / `data-rf.json` for `war-rf-ua-attacks`) across all pipelines, establishing a deterministic two-tier data architecture without disk caches.
- Added commodity category trade dynamics extraction across 8 NBU commodity groups from `Trade_y.xlsx` in `ukraine` pipeline.
- Added HTTP HEAD pre-flight metadata verification (`fetchHeadMeta`) across pipelines to skip redundant downloads when upstream ETags or release timestamps are unchanged.
- Added centralized path resolvers (`paths.ts`), atomic dataset exporter (`exportDataset` in `dataset.ts`), `scaleMagnitude` and `range` in `math.ts`, and `fetchBinaryWithMeta` in `http.ts`.

#### Changed
- Changed ETL pipelines to ingest and sanitize upstream source data purely in memory, stripping unused SVG coordinates, KML XML overhead, and redundant launch metadata.
- Migrated `war-rf-ua-attacks` from 4.7 MB full-text Telegram dump to compact pre-parsed report snapshots (`data-ua.json` and `data-rf.json`), enabling instant offline builds and incremental crawling without Kaggle API token or Telegram scraper dependencies.
- Expanded historical ETL extraction in `world` (1990–latest) and `ukraine` (2010–latest) pipelines.
- Standardized all pipelines on `@/*` path aliases and native `if (import.meta.main)` execution entrypoints using `isUpdate()` and `isVerbose()`.

#### Removed
- Removed legacy `cache/` directories, intermediate JSON offset dumps, and temporary KML disk cache files across all pipelines.
- Removed obsolete `runUaEconomicPipeline` and `runWorldEconomicPipeline` legacy exports from `ukraine` and `world` pipelines.
- Removed redundant `process.loadEnvFile` calls across pipelines in favor of native Bun environment loading.

#### Fixed
- Fixed that historical NBU USD/UAH exchange rates prior to 2021 were 100x overstated by dividing quote rates by unit scale (`rate_per_unit`).

---

### Site (@graphs/site)

#### Added
- Added clean path-based routing (`/:slug/:section` and localized `/:lang/:slug/:section`) for all dashboard charts, replacing hash anchors with canonical URLs.
- Added dynamic page title synchronization (`<Project Title> — <Chart Title>`) across deep links, SSG pre-rendered HTML, and scroll-spy updates.
- Added automated filesystem discovery of project directories and section filenames in `react-router.config.ts`, generating multi-locale static SSG pre-rendered HTML for all section URLs without manual route imports.
- Added `Checkbox` component and `RangeSliderControl` (`'range-slider'`) for dual-handle period filtering, standardizing control header elements on a 28px (`h-7`) height.
- Added `#trade-categories` diverging stacked bar chart to Ukraine dashboard tracking foreign trade across 8 commodity groups, with absolute/percentage modes, category legend, and `themeColors.trade.categories` palette tokens.
- Added dynamic period range sliders across World and Ukraine dashboard charts, enabling inspection from historical baselines (1990 / 2010) through latest available years with dynamic Top-N entity rankings.
- Added automatic 2D containment detection (`hideIfOverflowBar`) and default `hideOverlap: true` in `chart-builder.ts`, hiding bar segment labels that exceed column bounds.
- Added dynamic chart layout engine (`adjustChartLayout`) in `SectionChart.tsx` resolving legend wrapping, Y-axis label clearance, and toolbox alignment via runtime ECharts model inspection.
- Extracted isolated, modular section builder files (`site/src/projects/<slug>/sections/<section-id>.ts`) across all 6 project dashboards.
- Added custom Unicode CLDR unit definitions for `energy-terawatt-hour` (TWh / ТВт·ч) and `person` denominator rate patterns in `extract-cldr-units.ts` across all 4 locales.

#### Changed
- Changed `SectionNav` and `AnchorButton` to display and link directly to canonical section paths (`/{section}`) with clipboard URL copying and smooth section scrolling.
- Changed `useScrollSpy` to synchronize the URL path via `history.replaceState` and update `document.title` on `scrollend`.
- Changed project specifications (`project.ts`) across all dashboards to dynamically import section builders via Vite `import.meta.glob`, eliminating manual section imports while preserving canonical order from `meta.sections`.
- Moved `useScrollSpy` hook inside `SectionNav` to isolate scroll position state from the main dashboard, eliminating unnecessary chart re-renders.
- Changed `computeEndLabelClearance` to dynamically compute line chart right margin from series termination coordinates and rendered grid width.
- Changed chart data transforms across dashboards to use direct array slicing (`.slice()`) instead of manual index mapping, with automatic zero-value filtering enabled across tooltip formatters.
- Changed site favicon (`favicon.svg`) to synchronize with the brand navbar logo icon badge.
- Optimized localized formatting in `format.ts` by caching `Intl.NumberFormat` and `Intl.DateTimeFormat` instances, and coalesced canvas resize handling with `requestAnimationFrame`.

#### Removed
- Removed legacy `anchorId` across `BaseSectionSpec`, `AnchorButton`, and `Section` components in favor of canonical `id`.

#### Fixed
- Fixed that multi-line legends and `AnchorButton` collided with `yAxis.name` and data grid by dynamically constraining legend bounds and container top offset.
- Fixed that Y-axis on Ukraine `budget-and-debt` chart dropped below zero on historical intervals by clamping net borrowing to non-negative values and setting `yAxis.min: 0`.
- Fixed that chart canvas became blurry on browser zoom or display scale changes by tracking dynamic `devicePixelRatio` and re-allocating canvas backing stores.
- Fixed that scrolling and section navigation stripped the router basename (`/graphs`) from browser URLs by distinguishing app-relative routes (`getPath`) from browser-level URLs (`getHref`).
- Fixed that scrolling past sections replayed canvas entrance animations and caused layout jitter by isolating scroll tracking in `SectionNav` and stabilizing the `ProjectPage` route key on slug and lang.
- Fixed that electricity Y-axis labels rendered raw unit identifiers (`energy-terawatt-hour`, `kW-hour/person`) instead of localized symbols by adding custom CLDR units and narrow unit overrides.

---

## [1.2.0] - 2026-10-04

### Tooling & Types

#### Added
- Extracted shared domain schemas and slug definitions into dedicated `@graphs/types` workspace package (`types/package.json`).
- Added `types/projects/ai-tokens.ts` defining `AiTokensDataset`, `AiRegion`, `AiCompanyId`, and company/region series schemas.
- Added `shares` property to `CompanySeriesItem` in `types/projects/ai-tokens.ts`.
- Added `types/projects/space-launches.ts` defining `SpaceLaunchesDataset`, `SpaceLaunchesSummary`, `PayloadCapacityData`, `DecadeCostsData`, `AvgPayloadData`, and `FailureRateData`.
- Added `knip.ts` configuration and `check:knip` scripts across monorepo packages for unused file, export, and dependency detection.
- Added project-wide `README.md` summarizing tech stack and architecture.
- Added GNU Affero General Public License v3.0 or later (`LICENSE`).

#### Changed
- Restructured `types/` into modular `types/projects/` directory matching project slugs.
- Renamed `types/ua-economic.ts` to `types/projects/ukraine.ts` and `types/world-economic.ts` to `types/projects/world.ts`.
- Updated `war-rf-ua-losses.ts` schemas to reflect flat columnar structures and canonical category types.
- Removed explicit `"version"` fields from workspace `package.json` files, managing release versions exclusively via `CHANGELOG.md`.
- Unified `StaticChartSpec` and `DynamicChartSpec` into polymorphic `ChartSectionSpec` with typed `buildView`.
- Updated GitHub Actions workflow runner to `ubuntu-24.04` and upgraded actions to Node 24 runtimes (`actions/checkout@v7`, `actions/cache@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`).

#### Removed
- Removed obsolete type definitions: `types/echarts.ts`, `types/projects.ts`, `types/space-launches.ts`.
- Removed obsolete `StaticChartSpec` and `DynamicChartSpec` interfaces.
- Removed legacy `TradeSeriesDataPoint` interface from `types/projects/ukraine.ts`.
- Removed presentation `unit` property from `WorldChartMetricData` interface in `types/projects/world.ts`.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `ai-tokens` ETL pipeline (`pipelines/src/ai-tokens/index.ts`) scraping time-series data from `tokensperday.com` with local cache fallback and macro-region and model provider aggregation.
- Added precomputation of monthly company throughput shares in `ai-tokens` pipeline.
- Added season (`winter`, `spring`, `summer`, `autumn`) centroid imputation to `war-rf-ua-losses` date parser.
- Added volunteer punctuation typo sanitization and textual month range recognition in `war-rf-ua-losses` date parser.
- Added dynamic current-date validation to `war-rf-ua-losses` date parser, marking any future dates beyond runtime date as unrecognized.
- Added precomputation of global annual and decade metrics in `space-launches` ETL pipeline (`totalPayloadTons`, `totalAttempts`, `globalSuccessRate`, launch costs, average payload, failure rates).
- Added `avgPayload` and `failureRates` analytical datasets to `space-launches` pipeline output.
- Added MapLibre geospatial loss data extraction (`lng`, `lat`, `posts`, `sources`) to `war-rf-ua-losses` pipeline.
- Added `pipelines/src/utils/region.ts` for ISO 3166-1 alpha-2 / UN code normalization using `i18n-iso-countries`.

#### Changed
- Renamed pipelines `ua-economic` to `ukraine` and `world-economic` to `world`.
- Refactored `war-rf-ua-losses` dataset output (`overallTimeline` and `categoryChart`) to pure columnar arrays (`rf`, `ua`, `breakdowns`), reducing JSON artifact size by 42%.
- Overhauled equipment classification rules in `classification.json` to map raw equipment names directly to canonical English model names and 8 standard categories.
- Replaced Russian category and side identifiers in `war-rf-ua-losses` with canonical string literals (`WarLossCategory` and `'RF' | 'UA' | 'UNK'`).
- Converted snake_case schema properties to camelCase across all pipeline outputs (`space-launches`, `war-rf-ua-attacks`, `ukraine`).
- Pre-computed budget ratios, GDP percentages, and sorted sovereign trade partners in `ukraine` pipeline.
- Deflated machinery and manufacturing value added by US CPI in `world` pipeline.

#### Removed
- Removed `gx_media_links` fallback in `war-rf-ua-losses` pipeline, preventing internal Google hosted images from generating broken download links.
- Removed `concurrency.ts` (`pMap`) utility from `pipelines/src/utils/`.
- Removed presentation `unit` strings from `world` pipeline output, keeping datasets strictly numeric.
- Removed `Others` residual partner calculation and nested yearly breakdown arrays from `ukraine` pipeline.
- Removed obsolete cache files: `headers_meta.json` and `usd_rates.json` from `ukraine`, and old cache files from `world`.
- Removed redundant presentation and audit fields (`filter_start_date`, `days_covered`, `months_covered`, `audit`, `share_pct`) from `war-rf-ua-attacks` output.

#### Fixed
- Fixed trade volume calculation and sovereign partner sorting in `ukraine` pipeline.
- Fixed handling of unclassified and ambiguous equipment entries in `war-rf-ua-losses` parser.

---

### Site (@graphs/site)

#### Added
- Migrated site from Astro to React Router v7 static site generation (SSG) with multi-locale static pre-rendering across all routes (`root.tsx`, `SiteLayout.tsx`, `routes.ts`, `react-router.config.ts`).
- Upgraded styling toolchain to Tailwind CSS v4 using CSS-first `@theme` design tokens and `@utility` shortcuts in `global.css`.
- Added Ukrainian (`uk`) and German (`de`) localizations across common UI dictionaries, all dashboard modules, and Unicode CLDR datasets.
- Added `ai-tokens` dashboard tracking daily AI inference throughput by macro-region and model provider with absolute volume and market share toggle modes.
- Added interactive MapLibre GL vector map (`LossesMap.tsx`) in `war-rf-ua-losses` visualizing geolocated equipment losses with dynamic clustering and event popups.
- Added military equipment silhouette vector icons (`CategoryIcon.tsx`, `category-markers.ts`) across map markers, filter pills, comparison breakdown headers, and chart tooltips.
- Added average payload mass per launch and nation reliability failure rate charts to `space-launches` dashboard.
- Added `chartOption` smart visualization builder in `chart-builder.ts` with automatic point metadata type inference (`InferPointData`) from series data.
- Added declarative tooltip engine (`tooltipEngine`) in `chart-builder.ts` with `axis`, `dual`, and `table` modes, automatic descending sorting, semantic color indicators, and summary footers.
- Added `chartSection` factory and compile-time type resolvers inferring strongly-typed control parameters in `buildView` directly from declared sliders and toggle controls.
- Added polymorphic `SectionBreakdown` component rendering side-by-side comparison grids with ratio badges and accordion breakdown items.
- Added standalone styled 404 page (`NotFoundPage.tsx`) pre-rendered at `/404` and localized `/:lang/404` routes.
- Added build-time CLDR unit extraction script (`extract-cldr-units.ts`) compiling compact per-locale unit datasets (`cldr/{lang}.json`) from `cldr-units-full`.
- Added focused React hooks in `locales.tsx`: `useLanguage`, `useTranslation`, `useFormat`, and `useCatalog`.
- Added `fmt.ratio` formatter in `format.ts` for proportional ratio formatting across locales.
- Added universal semantic color resolution utility (`color.ts`) unifying color tokens, Tailwind classes, and hex codes.
- Added columnar transposition utility `zipRecords` and bar series builders `createBarSeries` and `createStackTotalSeries` in `chart-builder.ts`.
- Added animated glassmorphic loading spinner (`LoadingSpinner.tsx`) supporting full-screen and card-level loading states.
- Added dynamic domain registry in `registry.ts` discovering project metadata, specifications, and localized dictionaries via Vite `import.meta.glob`.
- Added two-tier dynamic code-splitting: root locale preloading in `root.tsx` and project bundle loading via React 19 `use(loadProjectBundle)` in `ProjectPage.tsx`.
- Extracted domain styling from `global.css` into dedicated stylesheets: `tags.css`, `changelog.css`, and `map.css`.
- Added summary footers to all `space-launches` decade chart tooltips displaying precomputed worldwide totals and metrics in O(1) time.
- Added Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slider`, `@radix-ui/react-toggle-group`) and `cmdk` search select.
- Added volume vs share metric toggle control to `tokens-by-company` chart section in `ai-tokens` dashboard.
- Added volume vs share metric toggle control to `payload-capacity` chart section in `space-launches` dashboard.

#### Changed
- Renamed project slugs and directories `ua-economic` to `ukraine` and `world-economic` to `world` across paths, URLs, specifications, and translation files.
- Migrated dashboards to progressive chart rendering, allowing page headers, descriptions, tags, and KPI metric cards to render immediately without waiting for ECharts canvases.
- Split project localization slices into lightweight catalog metadata (`meta-{lang}.ts`) and on-demand chart dictionaries (`dict-{lang}.ts`).
- Consolidated chart builder utilities, canvas theme invariants, bar series helpers, and tooltip formatters into `chart-builder.ts`.
- Replaced standalone tooltip builder functions with discriminated union `ChartTooltipSpec` consumed directly by `chartOption`.
- Unified multi-parameter callbacks across `chart-builder.ts` to accept single strongly-typed context objects (`TooltipTickContext`, `TooltipRowContext`, `DualGroupTotalContext`, `BarLabelContext`, `StackTotalContext`).
- Refactored `format.ts` into modular sections for CLDR schemas, numerical/monetary/temporal formatters, CLDR unit formatters, and region colors.
- Renamed `fmt.color` to `fmt.regionColor` in `format.ts`.
- Enhanced `getLocalizedPath` in `locales.tsx` to preserve search queries and hash fragments during language switching.
- Migrated changelog rendering in `ChangelogPage.tsx` to on-demand chunk loading via React 19 `use(loadChangelog())`, code-splitting `marked`.
- Decoupled `SITE_VERSION` extraction in `version.ts` to build-time `__SITE_VERSION__` define in `vite.config.ts`.
- Migrated 100% of dashboard chart sections across all projects to `chartSection` and `chartOption`.
- Refactored `ChartSectionSpec` in `section.ts` to extend `BaseSectionSpec`, eliminating parameter casting in `buildView`.
- Refactored `space-launches`, `ukraine`, `war-rf-ua-losses`, and `war-rf-ua-attacks` charts to consume flat columnar arrays composed via `zipRecords`.
- Localized Y-axis measurement and currency units across dashboards (`fmt.per`, `fmt.scale`), replacing hardcoded English strings.
- Removed redundant `axisLabel.formatter` on Y-axes where axis titles already declare units or percentages.
- Set default ECharts canvas grid bottom offset to 0, dynamically adding clearance only when a `dataZoom` slider is active.
- Enhanced tooltips in `ai-tokens` and `space-launches` dashboards to display both absolute metrics and percentage shares in parentheses.
- Limited Y-axis maximum to 100% when displaying percentage shares across `ai-tokens` and `space-launches` area charts.
- Dynamically computed annual launch totals and payload capacity shares in `space-launches` dashboard based on active top-N nations.

#### Removed
- Removed Astro toolchain, `.astro` pages, layouts, and components (`astro.config.mjs`, `Layout.astro`, `CatalogGrid.tsx`, `EChart.tsx`, `ChartCard.tsx`, `ViewToggle.tsx`).
- Removed `tailwind.config.mjs` in favor of Tailwind v4 CSS `@theme` configuration.
- Removed legacy imperative tooltip helpers and deleted `site/src/utils/tooltip.ts`.
- Removed boilerplate project route wrapper files (`projects/<slug>/page.tsx`) and catalog directory (`site/src/projects/catalog/`).
- Removed monolithic `useLocale()` hook.
- Removed dead translation keys from `common.ts` and co-located project-specific strings into project dictionaries.
- Removed trailing colons and exclamation marks from locale dictionaries.
- Removed redundant `— Graphs` document title suffix across pages.
- Removed artificial `Others` residual partner and nested yearly breakdown arrays from `ukraine` chart options.
- Removed precomputed static `totalLaunches` and `totalPayload` arrays from `space-launches` dataset in favor of dynamic active-region aggregation.

#### Fixed
- Fixed that clicking anchor copy button updated browser URL and history instead of only copying to clipboard.
- Fixed that deep links to sections were partially covered by sticky header by attaching anchor IDs to top-level section containers with scroll margins.
- Fixed that language switching dropped active scroll-spy hash and URL query parameters.
- Fixed that unknown routes redirected to catalog homepage instead of displaying the 404 page.
- Fixed that static assets and stylesheet links were missing repository subpath prefix on GitHub Pages.
- Fixed that language switching duplicated base path segments in URL navigation.
- Fixed dynamic top clearance in ECharts options based on wrapped multi-line legend heights.
- Fixed that date range filter in `war-rf-ua-losses` map included undated points by strictly filtering out points without dates.
- Fixed that reset button in `war-rf-ua-losses` map failed to clear date input DOM elements.
- Fixed that clicking photo proof links in `war-rf-ua-losses` map triggered browser downloads by filtering out Google Usercontent attachment links.
- Fixed that `subValue` in `trade-partners` chart section included redundant dollar sign in share mode.
- Fixed that non-absolute series row sorting in `chart-builder.ts` failed when series data items were zipped objects.

---

## [1.1.0] - 2026-09-24

### Tooling & Types

#### Added
- Converted repository to a Bun workspaces monorepo managing `@graphs/site` and `@graphs/pipelines` with native `bun.lock`.
- Integrated Biome toolchain (`biome.json`) for linting, formatting, and import sorting.
- Added centralized domain schemas in `types/` mapped via `@/types` path alias (`space-launches`, `ua-economic`, `war-rf-ua-attacks`, `war-rf-ua-losses`, `world-economic`).
- Added `AGENTS.md` monorepo operating manual and architecture rulebook.

#### Changed
- Reconfigured GitHub Actions CI/CD (`.github/workflows/deploy.yml`) to use `oven-sh/setup-bun@v2`, pipeline snapshot caching, and direct deployment to GitHub Pages.
- Reduced CI workflow permissions from `contents: write` to `contents: read`, removing automated git commits of scraped datasets back to `main`.

#### Removed
- Removed npm dependencies, `site/package-lock.json`, `tsx`, `vitest`, ESLint, and Prettier configurations.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added native TypeScript ETL pipelines running on Bun:
  - `space-launches`: Launch Library 2 API client with base snapshot cache merging and orbital payload / launch cost analytics.
  - `world-economic`: Ingestion of DBnomics (World Bank WDI, IMF WEO), OWID Energy, and UN Comtrade API with API key authentication and rate limiting.
  - `ua-economic`: Excel processing with SheetJS (`xlsx`) and NBU exchange rate APIs for state budget, debt, and trade dynamics.
  - `war-rf-ua-losses`: Verified equipment loss parser using `fast-xml-parser` and Google My Maps KML data with 8 weapon classifications.
  - `war-rf-ua-attacks`: Kaggle REST API downloader for RF attack data and high-concurrency Telegram MoD bulletin parser for UA interceptions.
- Added unit tests for Ukrainian defense bulletin parser (`pipelines/src/war-rf-ua-attacks/parse-ua.test.ts`) executed with `bun:test`.
- Added parallel pipeline runner in `pipelines/src/run-all.ts` using `Promise.allSettled` and scoped `consola` loggers.
- Added resilient HTTP client in `pipelines/src/utils/http.ts` with exponential backoff retries on HTTP 429 and 5xx responses.
- Added file and metadata utilities in `pipelines/src/utils/` for compact single-line JSON serialization and dataset timestamp tracking.

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
- Added standardized tooltip HTML builders in `site/src/utils/tooltip.ts` (`createTooltipHeader`, `createTooltipRow`, `createTooltipTotal`, `createTooltipDivider`).
- Added scroll spy navigation in `Layout.astro` using `IntersectionObserver` with smooth scrolling to `[data-anchor-section]`.

#### Changed
- Converted `tokens.js` to strictly typed `tokens.ts` defining semantic color palettes (`attacks`, `losses`, `trade`, `country`) and `CHART_BASE_THEME`.
- Converted all dashboard pages (`space-launches.astro`, `ua-economic.astro`, `war-rf-ua-attacks.astro`, `war-rf-ua-losses.astro`, `world-economic.astro`) to render React chart components with `client:load`.
- Updated `Layout.astro` to accept project metadata and render `PageHeader` automatically.
- Updated `tailwind.config.mjs` to import design tokens from `tokens.ts`.

#### Removed
- Removed inline vanilla JavaScript `<script>` tags for ECharts initialization across all dashboard pages.
- Removed legacy vanilla JavaScript tag filter script and DOM manipulation routines from `index.astro`.
- Removed string-based tooltip formatter registry `site/src/charts/formatters.ts` and recursive `resolveFormatters` helper.
- Removed legacy Astro components `ChartCard.astro`, `EChart.astro`, and `KpiCard.astro`.
- Removed individual chart theme files in `site/src/styles/charts/*`.

#### Fixed
- Fixed Chromium scrollbar jitter and layout thrashing by replacing unthrottled window scroll listeners with debounced `scrollend` state updates.
- Fixed chart overflow and sizing errors during window resize by tracking chart container dimensions with `ResizeObserver`.

---

## [1.0.0] - 2026-09-23

### Tooling & Types

#### Added
- Added GitHub Actions workflow (`.github/workflows/deploy.yml`) for weekly automated pipeline execution, dataset commit/push, and static deployment to GitHub Pages.
- Added Python dependencies in `requirements.txt` (`pandas`, `numpy`, `requests`, `kagglehub`, `dbnomics`, `comtradeapicall`, `openpyxl`).
- Added Astro and Tailwind CSS build setup in `site/package.json`, `site/astro.config.mjs`, and `site/tailwind.config.mjs`.
- Added TypeScript configuration and project interfaces in `site/tsconfig.json` and `site/src/data/projects.ts`.
- Added repository `.gitignore` covering Python cache, node modules, and Astro build artifacts.

---

### Pipelines (@graphs/pipelines)

#### Added
- Added `pipelines/run_all.py` runner executing data pipelines sequentially with `-u`/`--update` flag support and `metadata.json` generation.
- Added `space_launches.py` ETL pipeline fetching launch records from Launch Library 2 API, merging with base archive `launches_base.json`, and computing yearly payload mass and decade costs per kg.
- Added `ua_economic.py` ETL pipeline downloading NBU macro spreadsheets (`C_budget_m.xlsx`, `Trade_y.xlsx`, `ZB_q_UAH.xlsx`, `GDP_y.xlsx`) and exchange rates API to calculate fiscal balance, debt ratios, and bilateral trade.
- Added `world_economic.py` ETL pipeline fetching data via DBnomics API (World Bank, IMF), UN Comtrade API (HS Chapter 84), and OWID Energy to aggregate macroeconomic and physical industrial capacity metrics.
- Added `war_rf_ua_attacks.py` ETL pipeline downloading Kaggle missile attacks datasets via `kagglehub` and aggregating monthly strike UAV and missile statistics.
- Added `war_rf_ua-losses.py` ETL pipeline downloading Google My Maps KML data and classifying verified equipment losses across 8 categories using regex rules in `classification.json`.

---

### Site (@graphs/site)

#### Added
- Added overview catalog page (`index.astro`) with tag-based filtering and project metadata cards.
- Added `space-launches` dashboard tracking annual orbital payload capacity to LEO/SSO (1958–2026) and launch costs per kg by decade.
- Added `ua-economic` dashboard tracking Ukraine state budget execution, defense vs non-defense spending, domestic revenues, external debt, and foreign trade structure.
- Added `world-economic` dashboard comparing 8 major economies across real GDP (PPP), capital goods machinery turnover (HS Chapter 84), electricity generation, manufacturing value added, clean energy, and per-capita electricity consumption.
- Added `war-rf-ua-attacks` dashboard tracking monthly strike UAV and missile launches (ballistic vs cruise) with summary KPI metric cards.
- Added `war-rf-ua-losses` dashboard tracking visually confirmed heavy combat equipment losses across 8 weapon categories, monthly timelines, and expandable model breakdown cards.
- Added `EChart.astro` component integrating Apache ECharts with dark theme presets, auto-resize via `ResizeObserver`, and client-side formatter hydration.
- Added `formatters.ts` registry providing serialization-safe ECharts tooltips and numeric axis formatters.
- Added reusable UI components: `Layout.astro`, `PageHeader.astro`, `ChartCard.astro`, `KpiCard.astro`, and `TagBadge.astro`.
- Added design tokens in `tokens.js` defining semantic color palettes, country colors, and base ECharts dark theme configurations.
