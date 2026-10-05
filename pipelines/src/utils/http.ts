import { getLogger } from '@/utils/logger';

/** Fetches a URL with retry logic, custom headers, and timeout. */
export async function fetchWithRetry(url: string, options: RequestInit & { retries?: number; backoffMs?: number; timeoutMs?: number } = {}): Promise<Response> {
  const { retries = 3, backoffMs = 1000, timeoutMs = 30000, headers, ...rest } = options;
  const logger = getLogger();

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    ...headers,
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        ...rest,
        headers: defaultHeaders,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        return res;
      }

      if (res.status === 429 || res.status >= 500) {
        const wait = backoffMs * 2 ** (attempt - 1);
        logger.warn(`HTTP ${res.status}: Retrying ${url} in ${wait}ms (attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      return res;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        const wait = backoffMs * 2 ** (attempt - 1);
        logger.warn(`Network Error: Retrying ${url} in ${wait}ms (attempt ${attempt}/${retries}): ${lastError.message}`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/** HTTP remote file metadata (ETag, Last-Modified, Content-Length) for cache invalidation. */
export interface RemoteFileMeta {
  etag?: string | null;
  lastModified?: string | null;
  contentLength?: string | null;
}

/** Fetches HTTP HEAD metadata for remote URL with retry logic. */
export async function fetchHeadMeta(url: string, options: { retries?: number; timeoutMs?: number } = {}): Promise<RemoteFileMeta | null> {
  const { retries = 2, timeoutMs = 15000 } = options;
  try {
    const res = await fetchWithRetry(url, { method: 'HEAD', retries, timeoutMs });
    if (!res.ok) return null;
    return {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      contentLength: res.headers.get('content-length'),
    };
  } catch {
    return null;
  }
}

/** Checks whether cached HTTP metadata matches current remote metadata. */
export function isRemoteMetaEqual(cached?: RemoteFileMeta | null, remote?: RemoteFileMeta | null): boolean {
  if (!cached || !remote) return false;
  if (cached.etag && remote.etag) {
    return cached.etag === remote.etag;
  }
  if (cached.lastModified && remote.lastModified) {
    return cached.lastModified === remote.lastModified;
  }
  return false;
}

/** Result of downloading a remote binary file with its HTTP caching headers. */
export interface FetchBinaryResult {
  buffer: Buffer;
  meta: RemoteFileMeta;
}

/** Fetches a remote binary file and its HTTP headers (ETag, Last-Modified, Content-Length) into memory with retry logic. */
export async function fetchBinaryWithMeta(url: string, options: RequestInit & { retries?: number; backoffMs?: number; timeoutMs?: number } = {}): Promise<FetchBinaryResult> {
  const res = await fetchWithRetry(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const meta: RemoteFileMeta = {
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
    contentLength: res.headers.get('content-length'),
  };
  return { buffer: Buffer.from(await res.arrayBuffer()), meta };
}
