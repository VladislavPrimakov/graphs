import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const brotliCompressAsync = promisify(zlib.brotliCompress);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

/** Standard Brotli quality level across all pipeline serialization tasks. */
export const DEFAULT_BROTLI_QUALITY = 9;

/** Per-file serialization queue ensuring disk writes execute strictly in FIFO order. */
const fileWriteQueues = new Map<string, Promise<void>>();

/** Ensures that the directory of the given file path exists. */
export async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** Checks if a file exists on disk. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Reads and parses a JSON file safely, asynchronously decompressing on a thread pool if ending with .br. */
export async function readJson<T>(filePath: string): Promise<T> {
  if (filePath.endsWith('.br')) {
    const rawBuffer = await fs.readFile(filePath);
    const decompressed = await brotliDecompressAsync(rawBuffer);
    return JSON.parse(decompressed.toString('utf-8')) as T;
  }
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Synchronously reads and parses a JSON file, decompressing with Brotli if ending with .br. */
export function readJsonSync<T>(filePath: string): T {
  if (filePath.endsWith('.br')) {
    const rawBuffer = readFileSync(filePath);
    const decompressed = zlib.brotliDecompressSync(rawBuffer);
    return JSON.parse(decompressed.toString('utf-8')) as T;
  }
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Writes data formatted as compact JSON (or pretty JSON if indent > 0).
 * If filePath ends with .br, schedules asynchronous Brotli compression on libuv thread pool.
 * Compressions for the same or different files run in parallel, while disk writes for each
 * file path are strictly serialized in the exact order writeJsonAsync was called (FIFO).
 */
export function writeJsonAsync(filePath: string, data: unknown, indent = 0): Promise<void> {
  const jsonStr = indent > 0 ? JSON.stringify(data, null, indent) : JSON.stringify(data);

  const compressionPromise: Promise<Buffer> = filePath.endsWith('.br')
    ? brotliCompressAsync(Buffer.from(jsonStr), {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: DEFAULT_BROTLI_QUALITY,
        },
      })
    : Promise.resolve(Buffer.from(`${jsonStr}\n`, 'utf-8'));

  const previousWrite = fileWriteQueues.get(filePath) || Promise.resolve();

  const currentWrite = Promise.all([previousWrite, compressionPromise]).then(async ([, buffer]) => {
    await ensureDir(filePath);
    await fs.writeFile(filePath, buffer);
  });

  const safeWrite = currentWrite.catch((err) => {
    console.warn(`[fs] Failed to write ${filePath}:`, err);
  });
  fileWriteQueues.set(filePath, safeWrite);

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
