import { getLogger } from './logger.js';

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
