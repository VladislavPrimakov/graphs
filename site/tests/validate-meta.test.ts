import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGE_CODES } from '@/utils/provider';

const distDir = path.resolve(import.meta.dirname, '../dist/client');
const projectsDir = path.resolve(import.meta.dirname, '../src/projects');

interface ProjectPageTarget {
  slug: string;
  section?: string;
  lang: string;
  filePath: string;
  relPath: string;
}

/** Discovers all project and section page targets dynamically from source directory structure. */
function getProjectPageTargets(): ProjectPageTarget[] {
  const projectSlugs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const targets: ProjectPageTarget[] = [];

  for (const slug of projectSlugs) {
    const sectionsDir = path.join(projectsDir, slug, 'sections');
    const sections = fs.existsSync(sectionsDir)
      ? fs
          .readdirSync(sectionsDir)
          .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
          .map((file) => file.replace(/\.ts$/, ''))
      : [];

    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      const langPrefix = lang === DEFAULT_LANGUAGE ? '' : lang;
      for (const section of ['', ...sections]) {
        const parts = [langPrefix, slug, section, 'index.html'].filter(Boolean);
        const filePath = path.join(distDir, ...parts);
        targets.push({
          slug,
          section: section || undefined,
          lang,
          filePath,
          relPath: parts.join('/'),
        });
      }
    }
  }

  return targets;
}

interface PageMetaReport {
  relPath: string;
  title?: string;
  description?: string;
  siteName?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  imageExists?: boolean;
  imageSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  errors: string[];
}

function extractMeta(html: string, target: ProjectPageTarget): PageMetaReport {
  const { relPath } = target;
  const errors: string[] = [];

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : undefined;

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
  const description = descMatch ? descMatch[1] : undefined;

  const siteNameMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+property="og:site_name"/i);
  const siteName = siteNameMatch ? siteNameMatch[1] : undefined;

  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+property="og:title"/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1] : undefined;

  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+property="og:description"/i);
  const ogDescription = ogDescMatch ? ogDescMatch[1] : undefined;

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+property="og:image"/i);
  const ogImage = ogImageMatch ? ogImageMatch[1] : undefined;

  const twitterCardMatch = html.match(/<meta\s+name="twitter:card"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+name="twitter:card"/i);
  const twitterCard = twitterCardMatch ? twitterCardMatch[1] : undefined;

  if (!title) errors.push('Missing <title>');
  if (!description) errors.push('Missing <meta name="description">');
  if (!siteName) errors.push('Missing og:site_name');
  if (!ogTitle) errors.push('Missing og:title');
  if (!ogDescription) errors.push('Missing og:description');
  if (!ogImage) errors.push('Missing og:image');
  if (!twitterCard) errors.push('Missing twitter:card');

  if (title && title.length > 60) {
    errors.push(`Title exceeds 60 chars (${title.length}): "${title}"`);
  }
  if (ogTitle && ogTitle.length > 60) {
    errors.push(`og:title exceeds 60 chars (${ogTitle.length}): "${ogTitle}"`);
  }
  if (description && description.length > 160) {
    errors.push(`Description exceeds 160 chars (${description.length}): "${description.slice(0, 60)}..."`);
  }
  if (ogDescription && ogDescription.length > 160) {
    errors.push(`og:description exceeds 160 chars (${ogDescription.length}): "${ogDescription.slice(0, 60)}..."`);
  }

  let imageExists = false;
  let imageSize = 0;
  let imageWidth: number | undefined;
  let imageHeight: number | undefined;

  if (ogImage) {
    const match = ogImage.match(/og\/([^?#]+)/);
    if (match) {
      const fileName = match[1];
      const localImagePath = path.join(distDir, 'og', fileName);
      if (fs.existsSync(localImagePath)) {
        const stat = fs.statSync(localImagePath);
        if (stat.size > 0) {
          imageExists = true;
          imageSize = stat.size;

          const buf = fs.readFileSync(localImagePath);
          if (buf.length >= 24 && buf.toString('ascii', 1, 4) === 'PNG') {
            imageWidth = buf.readUInt32BE(16);
            imageHeight = buf.readUInt32BE(20);
            const ratio = imageWidth / imageHeight;
            if (Math.abs(ratio - 1.905) > 0.05) {
              errors.push(`OG image aspect ratio ${ratio.toFixed(2)} (${imageWidth}x${imageHeight}) violates 1.91:1 standard: og/${fileName}`);
            }
          }
        } else {
          errors.push(`OG image file is 0 bytes: og/${fileName}`);
        }
      } else {
        errors.push(`OG image file not found on disk: og/${fileName}`);
      }
    } else {
      errors.push(`Invalid OG image URL format: ${ogImage}`);
    }
  }

  return {
    relPath,
    title,
    description,
    siteName,
    ogTitle,
    ogDescription,
    ogImage,
    twitterCard,
    imageExists,
    imageSize,
    imageWidth,
    imageHeight,
    errors,
  };
}

describe('OpenGraph & Social Metadata Validation', () => {
  test('validates that all pre-rendered project and section routes contain required social meta tags, correct lengths, and valid 1.91:1 OG images', () => {
    if (!fs.existsSync(distDir)) {
      throw new Error('dist/client directory not found. Please run "bun run build:site" first.');
    }

    const targets = getProjectPageTargets();
    expect(targets.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const target of targets) {
      if (!fs.existsSync(target.filePath)) {
        failures.push(`/${target.relPath}:\n  - Pre-rendered HTML file does not exist on disk`);
        continue;
      }
      const html = fs.readFileSync(target.filePath, 'utf-8');
      const report = extractMeta(html, target);
      if (report.errors.length > 0) {
        failures.push(`/${report.relPath}:\n  - ${report.errors.join('\n  - ')}`);
      }
    }

    if (failures.length > 0) {
      console.error(`\n❌ Metadata validation failed for ${failures.length} project pages:\n\n${failures.join('\n\n')}`);
    }

    expect(failures).toEqual([]);
  });
});
