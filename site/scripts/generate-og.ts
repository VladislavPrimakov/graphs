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

fs.mkdirSync(ogDir, { recursive: true });

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

    // Inject strict 1200x630 layout and styling
    await page.addStyleTag({
      content: `
        header, nav, #header-section-nav, aside, footer { display: none !important; }
        .loading-spinner-overlay { display: none !important; }
        .echarts-toolbox { display: none !important; }
        section:not([data-section="${sectionId}"]) { display: none !important; }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 1200px !important;
          height: 630px !important;
          overflow: hidden !important;
          background-color: #0b0f19 !important;
        }

        #root, main, .flex-col {
          padding: 0 !important;
          margin: 0 !important;
          gap: 0 !important;
        }

        [data-section="${sectionId}"] {
          width: 1152px !important;
          height: 582px !important;
          margin: 24px auto !important;
          display: flex !important;
          flex-direction: column !important;
        }

        [data-section="${sectionId}"] .card {
          width: 100% !important;
          height: 100% !important;
          max-height: 582px !important;
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

    const sectionEl = page.locator(`[data-section="${sectionId}"]`).first();
    await sectionEl.waitFor({ state: 'visible', timeout: 15000 });

    // Wait a moment for canvas animation and tiles to settle
    await page.waitForTimeout(1000);

    await page.screenshot({ path: outputPath });
    console.log(`  ✅ [captured 1200x630] ${slug}/${sectionId}`);
  } catch (err) {
    console.error(`  ❌ [failed] ${slug}/${sectionId}: ${(err as Error).message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const sections = getProjectSections();
  const totalTasks = sections.length;
  console.log(`📸 Generating ${totalTasks} section OG preview images in parallel...\n`);

  const browser = await chromium.launch({
    headless: true,
  });

  await Promise.all(sections.map(({ slug, sectionId }) => captureSection(browser, slug, sectionId)));

  await browser.close();
  server.stop();
  console.log(`\n🎉 All ${totalTasks} section OG images generated successfully in site/public/og/!`);
}

main().catch((err) => {
  console.error(err);
  server.stop();
  process.exit(1);
});
