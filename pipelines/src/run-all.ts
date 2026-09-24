import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectSlug } from '@/types';
import { runSpaceLaunchesPipeline } from './space-launches/index';
import { runUaEconomicPipeline } from './ua-economic/index';
import { fileExists, readJson } from './utils/fs';
import { getLogger, isVerbose } from './utils/logger';
import { runWarAttacksPipeline } from './war-rf-ua-attacks/index';
import { runWarLossesPipeline } from './war-rf-ua-losses/index';
import { runWorldEconomicPipeline } from './world-economic/index';

try {
  process.loadEnvFile?.();
} catch {
  // ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PipelineTask {
  name: ProjectSlug;
  run: (flags: { update: boolean; verbose: boolean }) => Promise<unknown>;
}

const PIPELINES: PipelineTask[] = [
  {
    name: 'ua-economic',
    run: ({ update, verbose }) => runUaEconomicPipeline(update, verbose),
  },
  {
    name: 'world-economic',
    run: ({ update, verbose }) => runWorldEconomicPipeline(update, verbose),
  },
  {
    name: 'space-launches',
    run: ({ update, verbose }) => runSpaceLaunchesPipeline(update, verbose),
  },
  {
    name: 'war-rf-ua-attacks',
    run: ({ update, verbose }) => runWarAttacksPipeline({ updateTg: update, updateRf: update, verbose }),
  },
  {
    name: 'war-rf-ua-losses',
    run: ({ verbose }) => runWarLossesPipeline(verbose),
  },
];

/** Executes all ETL data pipelines concurrently and verifies metadata integrity. */
export async function runAllPipelines(options: { update?: boolean; verbose?: boolean } = {}): Promise<void> {
  const verbose = options.verbose ?? isVerbose();
  const isUpdate = options.update ?? (process.argv.includes('-u') || process.argv.includes('--update'));
  const logger = getLogger('pipelines', verbose);
  const rootDir = path.resolve(__dirname, '../..');

  logger.info(`Starting Parallel Data Pipelines Refresh [${isUpdate ? 'Force Cache Refresh (-u)' : 'Cache-First / Incremental'}]`);

  const totalStart = Date.now();

  const results = await Promise.allSettled(
    PIPELINES.map(async (p) => {
      const t0 = Date.now();
      try {
        await p.run({ update: isUpdate, verbose });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        logger.debug(`Pipeline [${p.name}] finished in ${elapsed}s`);
        return { name: p.name, elapsed };
      } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        logger.error(`Pipeline [${p.name}] failed after ${elapsed}s:`, err);
        throw err;
      }
    }),
  );

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(2);
  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  const failedCount = results.length - successCount;

  const metaPath = path.resolve(rootDir, 'site/src/data/metadata.json');
  if (await fileExists(metaPath)) {
    try {
      const metadata = await readJson<Record<string, string>>(metaPath);
      logger.debug(`Verified site/src/data/metadata.json (${Object.keys(metadata).length} projects registered)`);
    } catch (e) {
      logger.warn(`Failed to parse metadata.json: ${e}`);
    }
  }

  if (failedCount === 0) {
    logger.success(`All ${successCount}/${PIPELINES.length} pipelines completed successfully in ${totalDuration}s`);
  } else {
    logger.error(`${failedCount} pipeline(s) failed execution!`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAllPipelines().catch((err) => {
    getLogger('pipelines').error('Fatal execution error:', err);
    process.exit(1);
  });
}
