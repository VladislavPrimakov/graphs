import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the repository root directory. */
export const REPO_ROOT = path.resolve(__dirname, '../../..');

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

loadEnv();

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

// 1. Cloudflare Account & Authentication
export const CLOUDFLARE_ACCOUNT_ID = requireEnv('CLOUDFLARE_ACCOUNT_ID');

// 2. Cloudflare R2 Storage (Private L1 Snapshot Mirror)
export const R2_ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID');
export const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY');
export const R2_BUCKET = requireEnv('R2_BUCKET');
export const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// 3. Upstream Data Source API Credentials
export const COMTRADE_API_KEY = requireEnv('COMTRADE_API_KEY');
export const KAGGLE_API_TOKEN = requireEnv('KAGGLE_API_TOKEN');
