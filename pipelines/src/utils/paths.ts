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

/** Returns the absolute path to site/public/data/<slug>/<fileName> for a project dataset. */
export function getSiteDataPath(slug: string, fileName = 'data.json'): string {
  return path.join(SITE_DATA_DIR, slug, fileName);
}

/** Returns the absolute path to site/public/data/<slug>/<fileName> for project-level toolbar metadata. */
export function getSiteProjectMetaPath(slug: string, fileName = 'toolbar-meta.json'): string {
  return path.join(SITE_DATA_DIR, slug, fileName);
}

/** Returns the absolute path to pipelines/src/<slug>/data.json for a project cache snapshot. */
export function getPipelineDataPath(slug: string): string {
  return path.join(PIPELINES_SRC_DIR, slug, 'data.json');
}

/** Returns the absolute path to site/public/data/metadata.json. */
export function getMetadataPath(): string {
  return path.join(SITE_DATA_DIR, 'metadata.json');
}

/** Loads environment variables from the repository root .env file into process.env if present. */
export function loadEnv(envPath = path.join(REPO_ROOT, '.env')): void {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    }
  } catch {
    // Silently continue if .env does not exist (e.g. in CI environments)
  }
}
