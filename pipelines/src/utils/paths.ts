import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the repository root directory. */
export const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Absolute path to the site/public/data directory. */
export const SITE_DATA_DIR = path.resolve(REPO_ROOT, 'site/public/data');

/** Absolute path to the pipelines/src directory. */
export const PIPELINES_SRC_DIR = path.resolve(REPO_ROOT, 'pipelines/src');

/** Returns the absolute path to site/public/data/<slug>.json for a project dataset. */
export function getSiteDataPath(slug: string): string {
  return path.join(SITE_DATA_DIR, `${slug}.json`);
}

/** Returns the absolute path to site/public/data/<slug>/<sectionId>/<fileName> for a section dataset. */
export function getSiteSectionDataPath(slug: string, sectionId: string, fileName = 'data.json'): string {
  return path.join(SITE_DATA_DIR, slug, sectionId, fileName);
}

/** Returns the absolute path to pipelines/src/<slug>/data.json for a project cache snapshot. */
export function getPipelineDataPath(slug: string): string {
  return path.join(PIPELINES_SRC_DIR, slug, 'data.json');
}

/** Returns the absolute path to site/src/data/metadata.json. */
export function getMetadataPath(): string {
  return path.join(SITE_DATA_DIR, 'metadata.json');
}
