# Graphs & Analytics Platform

An open-source interactive data visualization and analytics platform built on public datasets. The project provides a collection of interactive, responsive charts with deep drill-downs, zoomable timelines, localized metadata, and categorized breakdown views.

---

## Tech Stack

### Frontend & Visualization
- **React 19** — Core UI library with modern compiler support.
- **React Router v7** — Static Site Generation (SSG) with code-split route pre-rendering across multiple locales.
- **Apache ECharts** — Canvas visualization engine with custom themes, interactive tooltips, data zooming, and export capabilities.
- **Tailwind CSS v4** — High-performance utility styling engine driven by design tokens.

### Architecture & Runtime
- **TypeScript 5.9** — End-to-end type safety spanning shared schemas, ETL pipelines, and UI specifications.
- **Bun** — Ultra-fast JavaScript/TypeScript runtime, package manager, and test runner.
- **Vite 6** — Frontend build tool and development server.

### Code Quality & Analysis
- **Biome** — Rust-based ultra-fast code formatter and linter.
- **Knip** — Automated dead code, unused export, and dependency auditor.
- **TypeScript (`tsc --noEmit`)** — Compile-time validation across all packages and workspaces.

### Data Pipelines (ETL)
- **TypeScript Scrapers & Crawlers** — Cache-first pipeline jobs for fetching, auditing, and transforming open data sources.
- **Data Parsing Engines** — `fast-xml-parser`, `cheerio`, `xlsx` for parsing upstream feeds, sheets, and markup.

### CI/CD & Deployment
- **GitHub Actions** — Scheduled and push-triggered CI/CD pipeline for fresh dataset extraction, static pre-rendering, and automated GitHub Pages deployment.

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+)

### Installation
```bash
bun install
```

### Development
```bash
bun run dev
```

### Verification & Building
```bash
# Verify dead code (Knip), formatting/linting (Biome), types (tsc), and build the site:
bun run build:site

# Run full CI verification (ETL pipelines + site across all locales):
bun run build
```

---

## License

This project is licensed under the GNU Affero General Public License v3.0 or later ([AGPL-3.0-or-later](LICENSE)) — see the [LICENSE](LICENSE) file for details.

