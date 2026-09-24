import { AsyncLocalStorage } from 'node:async_hooks';
import { type ConsolaInstance, createConsola } from 'consola';
import type { ProjectSlug } from '@/types';

export type LoggerTag = ProjectSlug | 'pipelines';

const asyncLoggerStorage = new AsyncLocalStorage<ConsolaInstance>();

/** Checks whether verbose mode is requested via command line arguments. */
export function isVerbose(): boolean {
  return process.argv.includes('-v') || process.argv.includes('--verbose');
}

/** Creates a tagged consola logger instance with configured verbosity level. */
export function createTaggedLogger(tag: LoggerTag, verbose?: boolean): ConsolaInstance {
  const showVerbose = verbose ?? isVerbose();
  return createConsola({
    level: showVerbose ? 4 : 3,
  }).withTag(tag);
}

/** Runs an asynchronous task scoped to a tagged logger instance via AsyncLocalStorage. */
export function runWithLogger<T>(tag: LoggerTag, fn: () => Promise<T>, verbose?: boolean): Promise<T> {
  const logger = createTaggedLogger(tag, verbose);
  return asyncLoggerStorage.run(logger, fn);
}

/** Retrieves the ambient logger from AsyncLocalStorage, or falls back to a tagged logger. */
export function getLogger(fallbackTag: LoggerTag = 'pipelines', verbose?: boolean): ConsolaInstance {
  const store = asyncLoggerStorage.getStore();
  if (store) return store;
  return createTaggedLogger(fallbackTag, verbose);
}
