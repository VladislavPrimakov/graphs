import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT, R2_SECRET_ACCESS_KEY } from '@/utils/env';
import { getPipelineLogger } from '@/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the repository root directory. */
export const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Absolute path to the pipelines/raw directory (L1 snapshot mirror). */
export const PIPELINES_RAW_DIR = path.resolve(REPO_ROOT, 'pipelines/raw');

/** Returns the absolute path to the pipelines/raw/<slug> directory. */
export function getRawDataDir(slug?: string): string {
  return slug ? path.join(PIPELINES_RAW_DIR, slug) : PIPELINES_RAW_DIR;
}

/** Returns the absolute path to pipelines/raw/<slug>/<fileName> for a project cache snapshot. */
export function getRawDataPath(slug: string, ...segments: string[]): string {
  const fileSegments = segments.length > 0 ? segments : ['data.json'];
  return path.join(PIPELINES_RAW_DIR, slug, ...fileSegments);
}

/** Absolute path to site/public/data directory. */
export const SITE_DATA_DIR = path.resolve(REPO_ROOT, 'site/public/data');

/** Returns the absolute path to site/public/data/<segments...>. */
export function getSiteDataPath(...segments: string[]): string {
  return path.join(SITE_DATA_DIR, ...segments);
}

/** Returns the absolute path to site/public/data/metadata.json. */
export function getMetadataPath(): string {
  return path.join(SITE_DATA_DIR, 'metadata.json');
}

/** Ensures that the directory of the given file path exists. */
export async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** Checks whether a file exists on disk. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Reads and parses a UTF-8 JSON file asynchronously. */
export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Reads and parses a UTF-8 JSON file synchronously. */
export function readJsonSync<T>(filePath: string): T {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Per-file serialization queue ensuring disk writes execute strictly in FIFO order. */
const fileWriteQueues = new Map<string, Promise<void>>();

/**
 * Writes production dataset JSON directly to local site/public/data/<subPath>.
 * Serialized in FIFO order per file.
 */
export function writeJsonAsyncToSite(subPath: string, data: unknown, indent = 0): Promise<void> {
  const cleanSubPath = subPath.replace(/^data\//, '').replace(/^\/+/, '');
  const targetPath = getSiteDataPath(cleanSubPath);
  const jsonStr = indent > 0 ? `${JSON.stringify(data, null, indent)}\n` : `${JSON.stringify(data)}\n`;
  const previousWrite = fileWriteQueues.get(targetPath) || Promise.resolve();

  const currentWrite = previousWrite.then(async () => {
    await ensureDir(targetPath);
    await fs.writeFile(targetPath, jsonStr, 'utf-8');
  });

  const safeWrite = currentWrite.catch((err) => {
    console.warn(`[site] Failed to write ${targetPath}:`, err);
  });
  fileWriteQueues.set(targetPath, safeWrite);

  currentWrite.catch(() => {});
  return currentWrite;
}

/**
 * Writes raw L1 cache snapshot formatted as JSON to local disk (pipelines/raw/<slug>/...)
 * and automatically uploads it to Cloudflare R2 raw/<slug>/... if changed.
 * Writes for the same target are strictly serialized in FIFO order.
 */
export function writeJsonAsyncToR2(target: string, data: unknown, indent = 0): Promise<void> {
  const jsonStr = indent > 0 ? `${JSON.stringify(data, null, indent)}\n` : `${JSON.stringify(data)}\n`;
  const previousWrite = fileWriteQueues.get(target) || Promise.resolve();

  const currentWrite = previousWrite.then(async () => {
    await ensureDir(target);
    await fs.writeFile(target, jsonStr, 'utf-8');

    if (target.startsWith(PIPELINES_RAW_DIR)) {
      const relativeKey = path.relative(PIPELINES_RAW_DIR, target).replace(/\\/g, '/');
      const r2Key = `raw/${relativeKey}`;
      await uploadToR2IfChanged(r2Key, jsonStr, {
        contentType: 'application/json; charset=utf-8',
      });
    }
  });

  const safeWrite = currentWrite.catch((err) => {
    console.warn(`[r2] Failed to save L1 snapshot ${target}:`, err);
  });
  fileWriteQueues.set(target, safeWrite);

  currentWrite.catch(() => {});
  return currentWrite;
}

/** Awaits completion of all pending queued disk writes for a given file path (or all files if omitted). */
export async function flushPendingJsonSaves(filePath?: string): Promise<void> {
  if (filePath) {
    const promise = fileWriteQueues.get(filePath);
    if (promise) await promise;
    return;
  }
  await Promise.all(Array.from(fileWriteQueues.values()));
}

export interface R2ObjectInfo {
  key: string;
  etag: string;
  size: number;
}

export interface UploadResult {
  uploaded: boolean;
  md5: string;
  skipped?: boolean;
}

export interface DownloadResult {
  downloaded: boolean;
  md5?: string;
  skipped?: boolean;
}

export interface SyncL1Result {
  downloaded: number;
  skipped: number;
  failed: number;
}

let cachedS3Client: Bun.S3Client | null | undefined;

/** Returns a shared Bun.S3Client instance if R2 credentials are configured, or null otherwise. */
export function getR2Client(): Bun.S3Client | null {
  if (cachedS3Client !== undefined) {
    return cachedS3Client;
  }

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    cachedS3Client = null;
    return null;
  }

  cachedS3Client = new Bun.S3Client({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    endpoint: R2_ENDPOINT,
    bucket: R2_BUCKET,
  });

  return cachedS3Client;
}

/** Cleans an S3 ETag string by removing surrounding quotes and weak entity prefixes (W/). */
export function cleanEtag(etag?: string): string {
  if (!etag) return '';
  return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
}

/** Computes the hexadecimal MD5 checksum for a binary buffer, Uint8Array, or string. */
export function calculateMd5(data: Buffer | Uint8Array | string): string {
  return new Bun.CryptoHasher('md5').update(data).digest('hex');
}

/** Lists all objects under a given R2 bucket prefix, returning a map indexed by object key. */
export async function listR2Prefix(prefix: string): Promise<Map<string, R2ObjectInfo>> {
  const map = new Map<string, R2ObjectInfo>();
  const s3 = getR2Client();
  if (!s3) return map;

  let continuationToken: string | undefined;
  try {
    do {
      const res = await s3.list({
        prefix,
        continuationToken,
        maxKeys: 1000,
      });

      for (const item of res.contents ?? []) {
        if (item.key) {
          map.set(item.key, {
            key: item.key,
            etag: cleanEtag(item.eTag),
            size: item.size ?? 0,
          });
        }
      }

      continuationToken = res.isTruncated ? res.nextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    getPipelineLogger('r2').warn(`Failed to list R2 prefix "${prefix}": ${err}`);
  }

  return map;
}

/**
 * Downloads an object from R2 to localFilePath only if the local file is missing
 * or its MD5 checksum differs from the remote object ETag.
 */
export async function downloadFromR2IfChanged(
  key: string,
  localFilePath: string,
  options: {
    knownRemoteEtag?: string;
    remoteEtagMap?: Map<string, R2ObjectInfo>;
  } = {},
): Promise<DownloadResult> {
  const s3 = getR2Client();
  if (!s3) {
    return { downloaded: false, skipped: true };
  }

  let remoteEtag = options.knownRemoteEtag;

  if (!remoteEtag && options.remoteEtagMap) {
    remoteEtag = options.remoteEtagMap.get(key)?.etag;
  }

  if (!remoteEtag) {
    try {
      const stat = await s3.stat(key);
      remoteEtag = cleanEtag(stat?.etag);
    } catch {
      // Object does not exist remotely
    }
  }

  if (!remoteEtag) {
    return { downloaded: false, skipped: true };
  }

  // Check whether local file exists and matches remote MD5 (ETag)
  try {
    const localBuffer = await fs.readFile(localFilePath);
    const localMd5 = calculateMd5(localBuffer);
    if (localMd5.toLowerCase() === cleanEtag(remoteEtag).toLowerCase()) {
      return { downloaded: false, skipped: true, md5: localMd5 };
    }
  } catch {
    // Local file missing or inaccessible, proceed to download
  }

  try {
    const buffer = Buffer.from(await s3.file(key).arrayBuffer());
    await ensureDir(localFilePath);
    await fs.writeFile(localFilePath, buffer);
    const md5 = calculateMd5(buffer);
    return { downloaded: true, md5 };
  } catch (err) {
    getPipelineLogger('r2').warn(`Failed to download ${key} from R2: ${err}`);
    return { downloaded: false, skipped: false };
  }
}

/**
 * Uploads data to R2 only if the remote object is missing or its ETag (MD5) differs.
 */
export async function uploadToR2IfChanged(
  key: string,
  data: Buffer | Uint8Array | string,
  options: {
    contentType?: string;
    cacheControl?: string;
    knownRemoteEtag?: string;
    remoteEtagMap?: Map<string, R2ObjectInfo>;
  } = {},
): Promise<UploadResult> {
  const localMd5 = calculateMd5(data);
  const s3 = getR2Client();

  if (!s3) {
    return { uploaded: false, md5: localMd5, skipped: true };
  }

  let remoteEtag = options.knownRemoteEtag;
  if (!remoteEtag && options.remoteEtagMap) {
    remoteEtag = options.remoteEtagMap.get(key)?.etag;
  }

  if (!remoteEtag) {
    try {
      const stat = await s3.stat(key);
      remoteEtag = cleanEtag(stat?.etag);
    } catch {
      // Object does not exist remotely
    }
  }

  if (remoteEtag && cleanEtag(remoteEtag) === localMd5) {
    return { uploaded: false, md5: localMd5, skipped: true };
  }

  try {
    const payload = data instanceof Uint8Array ? data : Buffer.isBuffer(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : String(data);

    await s3.write(key, payload, {
      type: options.contentType ?? 'application/octet-stream',
    });

    return { uploaded: true, md5: localMd5 };
  } catch (err) {
    getPipelineLogger('r2').warn(`Failed to upload ${key} to R2: ${err}`);
    return { uploaded: false, md5: localMd5, skipped: false };
  }
}

/**
 * Ensures required Tier 1 raw snapshots for a specific pipeline exist and match R2 in pipelines/raw/<slug>/,
 * downloading missing or modified files from R2 in parallel without downloading identical ones.
 */
export async function ensurePipelineL1(slug: string, expectedFiles?: string[]): Promise<SyncL1Result> {
  const s3 = getR2Client();
  const logger = getPipelineLogger(slug);
  const prefix = `raw/${slug}/`;

  if (!s3) {
    logger.debug(`R2 client not configured; skipping remote L1 sync for ${slug}`);
    return { downloaded: 0, skipped: 0, failed: 0 };
  }

  const remoteMap = await listR2Prefix(prefix);
  if (remoteMap.size === 0) {
    return { downloaded: 0, skipped: 0, failed: 0 };
  }

  const filesToCheck = expectedFiles ?? Array.from(remoteMap.keys()).map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : path.basename(k)));

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const downloadQueue: Promise<void>[] = [];

  for (const file of filesToCheck) {
    const localPath = getRawDataPath(slug, file);
    const r2Key = `${prefix}${file}`;

    downloadQueue.push(
      (async () => {
        if (!remoteMap.has(r2Key)) {
          return;
        }

        const res = await downloadFromR2IfChanged(r2Key, localPath, { remoteEtagMap: remoteMap });
        if (res.downloaded) {
          downloaded++;
        } else if (res.skipped) {
          skipped++;
        } else {
          failed++;
        }
      })(),
    );
  }

  await Promise.all(downloadQueue);

  if (downloaded > 0 || failed > 0) {
    logger.info(`L1 Cache Sync: ${downloaded} downloaded from R2, ${skipped} up-to-date, ${failed} failed`);
  }

  return { downloaded, skipped, failed };
}
