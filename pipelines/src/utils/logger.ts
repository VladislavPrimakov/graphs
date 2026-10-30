import { AsyncLocalStorage } from 'node:async_hooks';
import { type ConsolaInstance, createConsola } from 'consola';

/** Canonical string identifier for scoping pipeline log output to a specific project or subsystem. */
export type LoggerTag = string;

const asyncLoggerStorage = new AsyncLocalStorage<ConsolaInstance>();

/** Checks whether verbose mode is requested via command line arguments. */
export function isVerbose(): boolean {
  return process.argv.includes('-v') || process.argv.includes('--verbose');
}

/** Checks whether force update mode is requested via command line arguments. */
export function isUpdate(): boolean {
  return process.argv.includes('-u') || process.argv.includes('--update');
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

/**
 * Pipeline stage logger bound to a specific numbered or named ETL stage.
 */
export class PipelineStageLogger {
  constructor(
    public readonly parent: PipelineLogger,
    public readonly stage: number | string,
    public readonly name: string,
  ) {}

  info(message: string, ...args: unknown[]): this {
    this.parent.raw.info(`[Stage ${this.stage}: ${this.name}] ${message}`, ...args);
    return this;
  }

  warn(message: string, ...args: unknown[]): this {
    this.parent.raw.warn(`[Stage ${this.stage}: ${this.name}] ${message}`, ...args);
    return this;
  }

  error(message: string, ...args: unknown[]): this {
    this.parent.raw.error(`[Stage ${this.stage}: ${this.name}] ${message}`, ...args);
    return this;
  }

  debug(message: string, ...args: unknown[]): this {
    this.parent.raw.debug(`[Stage ${this.stage}: ${this.name}] ${message}`, ...args);
    return this;
  }

  success(message: string, ...args: unknown[]): this {
    this.parent.raw.success(`[Stage ${this.stage}: ${this.name}] ${message}`, ...args);
    return this;
  }

  progress(current: number, total: number, message: string): this {
    this.parent.raw.info(`[Stage ${this.stage}: ${this.name}] [${current}/${total}] ${message}`);
    return this;
  }
}

/**
 * Standardized pipeline logger wrapping ConsolaInstance with builder methods
 * for typical ETL pipeline milestones and stage progress without passing logger around.
 */
export class PipelineLogger {
  constructor(
    public readonly raw: ConsolaInstance,
    public readonly tag: string,
  ) {}

  /** Logs standardized pipeline start banner: e.g. "Starting Country ETL pipeline". */
  start(name?: string): this {
    this.raw.start(`Starting ${name ?? this.tag} ETL pipeline`);
    return this;
  }

  /** Logs standardized cache match / unchanged status. */
  unchanged(reason: string): this {
    this.raw.info(`Remote sources unchanged (${reason}). Using cached dataset.`);
    return this;
  }

  /** Logs standardized upstream update detection. */
  detected(action: string): this {
    this.raw.info(`New upstream data detected. ${action}...`);
    return this;
  }

  /**
   * Scopes logging to a specific pipeline stage.
   * If message is provided, logs it immediately.
   * Always returns a PipelineStageLogger for further stage-scoped progress and warnings.
   */
  stage(stage: number | string, name: string, message?: string): PipelineStageLogger {
    if (message) {
      this.raw.info(`[Stage ${stage}: ${name}] ${message}`);
    }
    return new PipelineStageLogger(this, stage, name);
  }

  /** Logs indexed progress for a pipeline stage: e.g. logger.progress(2, 'Goods', i + 1, total, 'US missing 35 years') */
  progress(stage: number | string, name: string, current: number, total: number, message: string): this {
    this.raw.info(`[Stage ${stage}: ${name}] [${current}/${total}] ${message}`);
    return this;
  }

  /** Logs a warning scoped to a pipeline stage. */
  stageWarn(stage: number | string, name: string, message: string): this {
    this.raw.warn(`[Stage ${stage}: ${name}] ${message}`);
    return this;
  }

  /** Logs standardized export summary. */
  exported(summary: string, slug?: string): this {
    this.raw.info(`Exported ${slug ?? this.tag} datasets (${summary})`);
    return this;
  }

  /** Logs standardized pipeline completion success message. */
  complete(summary: string, name?: string): this {
    this.raw.success(`${name ?? this.tag} pipeline complete: ${summary}`);
    return this;
  }

  /** Passthrough logging methods matching standard Consola API */
  info(message: string, ...args: unknown[]): this {
    this.raw.info(message, ...args);
    return this;
  }

  warn(message: string, ...args: unknown[]): this {
    this.raw.warn(message, ...args);
    return this;
  }

  error(message: string, ...args: unknown[]): this {
    this.raw.error(message, ...args);
    return this;
  }

  debug(message: string, ...args: unknown[]): this {
    this.raw.debug(message, ...args);
    return this;
  }

  success(message: string, ...args: unknown[]): this {
    this.raw.success(message, ...args);
    return this;
  }
}

/** Retrieves a PipelineLogger instance bound to the ambient or given tag. */
export function getPipelineLogger(fallbackTag: LoggerTag = 'pipelines', verbose?: boolean): PipelineLogger {
  const raw = getLogger(fallbackTag, verbose);
  return new PipelineLogger(raw, fallbackTag);
}
