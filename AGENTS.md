# AGENTS.md — Agent Operating Manual & Repository Rulebook

Operational guide and rulebook for AI agents working on the `graphs` repository.

---

## 1. General Operating Rules & Standards

### 1.1 General Operating Rules

- **Full Verification**: Run `bun run build` (Biome, TSC across all workspaces, and Astro build).
- **Unit Tests**: Run `bun test` (`bun:test`) when modifying parsers, regex, or ETL logic.
- **English Policy**: All UI text, tooltips, comments, and metadata must be 100% English (zero Cyrillic).
- **Cleanliness**: Never commit temporary files (`*.tmp`, `*.log`) or scratch scripts.

### 1.2 Code Documentation Standards

1. **Language**: English only across all code comments and JSDoc blocks.
2. **Format & Prohibitions**:
   - **No `@param` or `@returns`**: TypeScript types and signatures are the single source of truth.
   - **No File Headers**: Never write `@fileoverview` or author banners. Start with imports.
   - **JSDoc vs Inline**: Use JSDoc `/** ... */` for exported symbols; never use `//`.
3. **Prop, Field & Type Documentation**:
   - **Single-line JSDoc**: Format type fields and props with single-line `/** Description. */`.
   - **Defaults & Units**: Use `@default <val>`. Explicitly document units (`USD`, `TWh`, `px`, `%`), 1-based indexing, or nullability.
   - **Omission**: Omit comments for trivial, self-explanatory properties.
4. **Components & Functions**:
   - 1–2 sentences explaining rendering or computation logic.
   - Optional short `@example` (5–8 lines max) if usage is non-obvious.

---

## 2. End-to-End System Pipeline

```
[ External Sources ] (Telegram, Kaggle, APIs)
       │
       ▼
[ pipelines/src/ ] ──── TypeScript ETL scrapers & parsers (fetch, clean, audit, transform)
       │
       ├─► [ site/src/data/*.json ] ──── Static datasets + metadata.json
       │
       ▼
[ types/ ] ──── SSoT TypeScript Schemas (@/types) shared across pipelines and UI
       │
       ▼
[ site/ ] ──── Astro static site generator (static HTML + ECharts)
```

**Key Invariants**:

- Pipelines never touch Astro templates; Astro templates never execute pipeline scripts.
- Datasets in `site/src/data/*.json` are generated dynamically at build time (ephemeral, excluded from Git).
- Pipeline scripts update timestamps in `site/src/data/metadata.json` via `updateMetadata('<project-slug>')`.

### 2.1 Automated CI/CD (`.github/workflows/deploy.yml`)

- **Trigger**: Every Monday at 03:00 UTC, on push to `main`, or via `workflow_dispatch`.
- **Workflow**: Runs `bun run pipelines` (generates fresh data), builds site (`bun run site`), and deploys directly to GitHub Pages.
- **New Pipelines**: Register in `pipelines/src/run-all.ts` and `package.json`.

---

## 3. Data Pipelines & Crawlers

### 3.1 CLI Execution & Flags

- **Commands**:
  - Run all: `bun run pipelines` (or `bun pipelines/src/run-all.ts`).
  - Run single: `bun --filter @graphs/pipelines <script>`.
- **Flags**:
  - `-u`, `--update`: Force cache refresh / re-download.
  - `-v`, `--verbose`: Enable debug logs (`consola` LogLevel 4) with HTTP traces and retry backoffs.
- **Environment Variables (`.env`)**: Loaded automatically via `process.loadEnvFile()`.
  - `COMTRADE_API_KEY`: UN Comtrade API v1 key (`Ocp-Apim-Subscription-Key`).
  - `KAGGLE_API_TOKEN`: Kaggle REST API Bearer token.

### 3.2 5-Stage Pipeline Lifecycle

1. **Cache Check**: Check cache directories. Use cached data whenever possible.
2. **Fetch / Scrape**: Cache-first by default; force cache refresh with `-u`.
3. **Clean & Audit**: Normalize taxonomy and audit parsed numbers against raw source data.
4. **Serialize**: Write static compact single-line JSON to `site/src/data/<project-slug>.json`.
5. **Metadata**: Update timestamp in `site/src/data/metadata.json` via `updateMetadata()`.

### 3.3 Universal ETL Invariants & Architecture

- **Single-Line Compact Storage**: Datasets in `site/src/data/*.json` MUST be stored as single-line compact JSON strings (`writeJson(..., 0)`). Excluded from formatting in `biome.json`.
- **Metadata Decoupling**: Datasets contain data only. Timestamps go to `metadata.json` via `updateMetadata()`; sources belong in `projects.ts`.
- **Default Run Without `-u`**: Automated runs execute without `-u`.
- **Unified Logger (`logger.ts`)**: Pipelines MUST use `getLogger('<tag>')` (`consola`). Methods: `.start()`, `.info()`, `.success()`, `.warn()`, `.error()`, `.debug()`.
- **Shared Utilities (`pipelines/src/utils/`)**:
  - `http.ts`: `fetchWithRetry` with backoff for 429/5xx and timeouts.
  - `concurrency.ts`: `runPool` for throttled batch requests.
  - `fs.ts`: `writeJson`, `readJson`, `ensureDir`, `fileExists`.
  - `metadata.ts`: `updateMetadata('<project-slug>')`.
- **Caching Policies**:
  - `war-rf-ua-losses`: Re-downloads KML (falls back to cache if offline).
  - `space-launches`: `-u` clears cache. Default merges recent launches into base dataset.
  - `world-economic`: `-u` clears cache. Default preserves historical years (`< current_year`).
  - `ua-economic`: `-u` clears cache. Default preserves historical rates (`< current_year`).
  - `war-rf-ua-attacks`:
    - `parse-rf`: Loads Kaggle cache (syncs with API if token is present).
    - `parse-ua`: `-u` purges cache. Default crawls new Telegram posts since latest cached ID.
- **Concurrency & Safety**: Use chunked asynchronous fetching (`runPool`) for batch requests.
- **Data Integrity**: Audit parsed figures against raw sources. Never drop or alter figures.
- **Pre-Computation**: Compute all metrics in ETL (totals, averages, peaks, ratios, timelines). Frontend only renders ready data.
- **Constraint for `parse-ua.ts`**: Strictly prohibits any comments (`//`, `/* */`) and docstrings.

---

## 4. Frontend & Visualization Architecture

### 4.1 Site Structure & Registry

- **`site/src/pages/`**: `index.astro` (catalog homepage) and `<project-slug>.astro` (visualization pages).
- **`site/src/layouts/Layout.astro`**: Shell layout (header tabs, activeNav, footer, scroll-spy).
- **`site/src/data/projects.ts`**: SSoT for catalog navigation, descriptions, and sources. Every new page **must** be registered in `PROJECTS`.
- **Standard Page Template**:

  ```astro
  ---
  import Layout from '../layouts/Layout.astro';
  import PageHeader from '../components/PageHeader.astro';
  import MyProjectGraph1 from '../components/graphs/MyProjectGraph1';
  import MyProjectGraph2 from '../components/graphs/MyProjectGraph2';
  import { getProject } from '../data/projects';
  import data from '../data/my-project.json';

  const project = getProject('my-project');
  const { graph1_data, graph2_data } = data;
  ---

  <Layout project="my-project">
    <PageHeader title={project.title} description={project.description} tags={project.tags} sources={project.sources} lastUpdated={project.lastUpdated} />
    <div class="space-y-8 sm:space-y-12">
      <section data-anchor-section="graph-1" class="scroll-mt-20 sm:scroll-mt-24">
        <MyProjectGraph1 client:load data={graph1_data} />
      </section>
      <section data-anchor-section="graph-2" class="scroll-mt-20 sm:scroll-mt-24">
        <MyProjectGraph2 client:load data={graph2_data} />
      </section>
    </div>
  </Layout>
  ```

### 4.2 Styling & Theme System (`tokens.ts`)

All design tokens reside in `site/src/styles/tokens.ts` (mapped in `tailwind.config.mjs`).

- **Palettes**: `surface`, `border`, `text`, `accent`, `status`, and `themeColors.<domain>` (`attacks`, `losses`, `budget`, `trade`, `country`).
- **Markup**: Use Tailwind semantic classes (`bg-surface-card`, `border-border-subtle`, `text-content-primary`).
- **Charts & Cards**: Import `themeColors` or `getCountryColor` from `tokens.ts`. Never write arbitrary hex strings.

### 4.3 Component Guide (React & Astro)

| Use Case                    | Component       | Type                  | Location             | Key Props                                                |
| --------------------------- | --------------- | --------------------- | -------------------- | -------------------------------------------------------- |
| Standalone Graph Widget     | `<*Graph>`      | React (`client:load`) | `components/graphs/` | domain dataset props                                     |
| Chart container card        | `<ChartCard>`   | React                 | `components/`        | `anchorId`, `headerRight`, `children`, `className`       |
| Metric KPI card             | `<KpiCard>`     | React                 | `components/`        | `label`, `value`, `subtext`, `valueColor`                |
| Interactive ECharts wrapper | `<EChart>`      | React                 | `components/`        | `option`, `height`, `chartId`, `onInit`                  |
| Hero header with metadata   | `<PageHeader>`  | Astro (static)        | `components/`        | `title`, `description`, `tags`, `sources`, `lastUpdated` |
| Category badge              | `<TagBadge>`    | Astro / React         | `components/`        | `tag`                                                    |
| Catalog grid with filters   | `<CatalogGrid>` | React (`client:load`) | `components/`        | `projects`, `allUniqueTags`                              |
| Shell layout                | `<Layout>`      | Astro (static)        | `layouts/`           | `title`, `activeNav`                                     |

### 4.4 Declarative Tooltip & Chart Functions

- **Tooltips & Formatters**: Pass native JS/TS formatting functions directly into ECharts `tooltip.formatter` and `axisLabel.formatter`.
- **UI State**: Manage toggles and filters declaratively via React hooks (`useState`) inside graph components.

### 4.5 Deep-Linking, Section Anchors & Scroll Performance

- **Section Anchors**: Wrap all deep-link sections in `<section data-anchor-section="<id>" class="scroll-mt-20 sm:scroll-mt-24">`.
- **Visual Card**: `ChartCard` accepts `anchorId` solely to render the copy-link button.
- **Scroll-Spy**: Monitored via `IntersectionObserver` in `Layout.astro`. URL hash updates on scroll idle (`scrollend` / 300ms timer) to prevent scroll lag.

### 4.6 Tree-Shaking Policy

- **Clean Imports**: Keep imports modular and explicit to ensure minimal client bundle size.
