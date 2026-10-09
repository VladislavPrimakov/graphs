# Graphs & Analytics Platform

An open-source, high-performance interactive data visualization and analytics platform built on public datasets. The project delivers responsive charts with deep drill-downs, zoomable timelines, vector GIS maps, localized metadata, and categorized breakdown views — fully statically pre-rendered with zero runtime server costs.

---

## Dashboards

- **Ukraine (`/ukraine`)** — State budget execution, sovereign debt dynamics, foreign trade balance, and commodity structure across 8 NBU categories.
- **War RF-UA (`/war-rf-ua`)** — Interactive MapLibre GL territorial frontline map (DeepState vs LostArmour consensus), daily territorial dynamics, geolocated equipment losses (19,800+ entries), and missile/UAV air strikes.
- **World Economic & Energy (`/world`)** — GDP (PPP), GDP per capita, electricity generation, clean power share, and machinery turnover metrics (1990–present) across sovereign nations.
- **Space Launches (`/space-launches`)** — Worldwide orbital space launches (1957–present), payload mass to orbit, nation reliability failure rates, and launch costs per kg.
- **AI Tokens (`/ai-tokens`)** — Global daily AI model inference throughput and market share by leading AI provider and macro-region.

---

## Tech Stack

### Frontend & Visualization
- **React 19** — Core UI library with automated React Compiler optimizations.
- **React Router v7** — Static Site Generation (SSG) with code-split route pre-rendering across 4 locales (`en`, `ru`, `uk`, `de`) and section deep links.
- **Apache ECharts** — High-performance Canvas/WebGL visualization engine with custom themes, declarative tooltips, and off-screen Retina PNG export (2400×1120).
- **MapLibre GL** — Vector tile GIS engine for geospatial equipment clustering and multi-polygon territorial control rendering.
- **Tailwind CSS v4** — CSS-first `@theme` design tokens and unified `@utility` shortcuts (`card`, `glass-bar`, `control-panel`).

### Architecture & Runtime
- **TypeScript 5.9** — End-to-end type safety spanning shared schemas, ETL pipelines, and UI specifications.
- **Bun** — Ultra-fast JavaScript/TypeScript runtime, package manager, and test runner.
- **Vite 6** — Frontend build tool and development server.
- **Two-Tier Data Architecture** — Committed minimal raw baseline (Tier 1) with fast-path in-memory transformations exporting compact ephemeral SSG datasets (Tier 2).

### Code Quality & Analysis
- **Biome** — Rust-based ultra-fast code formatter and linter.
- **Knip** — Automated dead code, unused export, and dependency auditor.
- **TypeScript (`tsc --noEmit`)** — Compile-time validation across all packages and workspaces.

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
# Build data pipelines (ETL):
bun run build:pipeline

# Run a single data pipeline (e.g. ukraine, war-rf-ua, world):
bun --filter @graphs/pipelines run:ukraine

# Build the site (Knip, Biome, tsc, and multi-locale SSG pre-rendering):
bun run build:site

# Run full CI verification (pipelines + site across all locales):
bun run build

# Preview production SSG build locally:
bun run preview
```

---

## License

This project is licensed under the GNU Affero General Public License v3.0 or later ([AGPL-3.0-or-later](LICENSE)) — see the [LICENSE](LICENSE) file for details.

