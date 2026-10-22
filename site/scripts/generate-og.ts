import fs from 'node:fs';
import path from 'node:path';
import { type Browser, chromium } from 'playwright';

const distDir = path.resolve(import.meta.dirname, '../dist/client');
const ogDir = path.resolve(import.meta.dirname, '../public/og');
const port = 4173;
const rawBase = process.env.BASE_URL ?? '/graphs';
const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/client directory not found. Please run "bun run build:site" first.');
  process.exit(1);
}

if (fs.existsSync(ogDir)) {
  for (const file of fs.readdirSync(ogDir)) {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(ogDir, file));
    }
  }
} else {
  fs.mkdirSync(ogDir, { recursive: true });
}

function getProjectSections(): { slug: string; sectionId: string }[] {
  const projectsDir = path.resolve(import.meta.dirname, '../src/projects');
  const slugs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const targets: { slug: string; sectionId: string }[] = [];
  for (const slug of slugs) {
    const sectionsDir = path.join(projectsDir, slug, 'sections');
    if (!fs.existsSync(sectionsDir)) continue;
    const files = fs
      .readdirSync(sectionsDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
      .map((file) => file.replace(/\.ts$/, ''));

    for (const sectionId of files) {
      targets.push({ slug, sectionId });
    }
  }
  return targets;
}

// 1. Start lightweight static server
const server = Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    if (base !== '/' && pathname.startsWith(base)) {
      pathname = pathname.slice(base.length) || '/';
    }

    const fullPath = path.join(distDir, pathname);

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const indexPath = path.join(fullPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          return new Response(Bun.file(indexPath));
        }
      } else {
        return new Response(Bun.file(fullPath));
      }
    }

    const htmlPath = `${fullPath}.html`;
    if (fs.existsSync(htmlPath)) {
      return new Response(Bun.file(htmlPath));
    }

    return new Response('404 Not Found', { status: 404 });
  },
});

console.log(`🚀 Preview server running on http://127.0.0.1:${server.port}${base}`);

async function captureSection(browser: Browser, slug: string, sectionId: string) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  try {
    const targetUrl = `http://127.0.0.1:${server.port}${base}/${slug}/${sectionId}`;
    const outputPath = path.join(ogDir, `${slug}-${sectionId}.png`);

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Inject strict 1200x630 layout and hide navigation, toolbars, and controls
    await page.addStyleTag({
      content: `
        header, nav, #header-section-nav, aside, footer { display: none !important; }
        .loading-spinner-overlay, [data-loading-spinner] { display: none !important; }
        .echarts-toolbox { display: none !important; }
        .anchor-btn { display: none !important; }
        [data-sticky-toolbar], .section-toolbar, .control-bar, .control-panel, [role="toolbar"] { display: none !important; }
        [data-radix-popper-content-wrapper], .maplibregl-popup, [class*="tooltip"] { display: none !important; }

        .section-group:not(:has([data-section="${sectionId}"])) { display: none !important; }
        section:not([data-section="${sectionId}"]) { display: none !important; }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 1200px !important;
          height: 630px !important;
          overflow: hidden !important;
          background-color: #0b0f19 !important;
        }

        #root, #root > div, main, .section-group {
          padding: 0 !important;
          margin: 0 !important;
          gap: 0 !important;
          max-width: none !important;
        }

        [data-section="${sectionId}"] {
          width: 1152px !important;
          height: 582px !important;
          margin: 24px auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
        }

        [data-section="${sectionId}"] .card {
          width: 100% !important;
          flex: 1 !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          padding: 20px !important;
          box-sizing: border-box !important;
          background-color: #111726 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 16px !important;
        }

        [data-section="${sectionId}"] .card > div:has(canvas) {
          flex: 1 !important;
          min-height: 0 !important;
        }

        [data-section="${sectionId}"] .maplibregl-map {
          flex: 1 !important;
          min-height: 440px !important;
        }
      `,
    });

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.dispatchEvent(new Event('resize'));
    });

    const sectionEl = page.locator(`[data-section="${sectionId}"]`).first();
    await sectionEl.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for any loading spinners to finish/detach
    await page
      .locator('[data-loading-spinner], .loading-spinner-overlay')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});

    // Ensure visualizer canvas or breakdown card content is mounted and sized
    await page
      .waitForFunction(
        (secId) => {
          const sec = document.querySelector(`[data-section="${secId}"]`);
          if (!sec) return false;

          // Ensure no active loading spinner
          if (sec.querySelector('[data-loading-spinner], .loading-spinner-overlay')) return false;

          // Check canvas visualizers (ECharts or MapLibre)
          const canvas = sec.querySelector('canvas');
          if (canvas) {
            return (canvas as HTMLCanvasElement).width > 0;
          }

          // Check breakdown grid or other non-canvas card
          const card = sec.querySelector('.card');
          return Boolean(card && card.children.length > 1);
        },
        sectionId,
        { timeout: 30000 },
      )
      .catch(() => {});

    // Settling delay for animations, fonts, and tiles to render cleanly on CI runners
    const settleDelay = Number(process.env.OG_SETTLE_MS ?? 2500);
    await page.waitForTimeout(settleDelay);

    await page.screenshot({ path: outputPath });
    console.log(`  ✅ [captured 1200x630] ${slug}/${sectionId}`);
  } catch (err) {
    console.error(`  ❌ [failed] ${slug}/${sectionId}: ${(err as Error).message}`);
  } finally {
    await context.close();
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const sections = getProjectSections();
  const totalTasks = sections.length;
  const concurrency = Number(process.env.OG_CONCURRENCY ?? 16);
  console.log(`📸 Generating ${totalTasks} section OG preview images with ${concurrency} concurrent workers...\n`);

  const browser = await chromium.launch({
    headless: true,
  });

  await runWithConcurrency(sections, concurrency, ({ slug, sectionId }) => captureSection(browser, slug, sectionId));

  await browser.close();
  server.stop();

  const distOgDir = path.join(distDir, 'og');
  if (fs.existsSync(distDir)) {
    fs.mkdirSync(distOgDir, { recursive: true });
    fs.cpSync(ogDir, distOgDir, { recursive: true });
  }

  console.log(`\n🎉 All ${totalTasks} section OG images generated successfully in site/public/og/ and site/dist/client/og/!`);
}

main().catch((err) => {
  console.error(err);
  server.stop();
  process.exit(1);
});
