import { fileExists, readJson } from '@/utils/fs';
import { getLogger, isUpdate, isVerbose } from '@/utils/logger';
import { getMetadataPath } from '@/utils/paths';
import { runAiTokensPipeline } from './ai-tokens/index';
import { runSpaceLaunchesPipeline } from './space-launches/index';
import { runUkrainePipeline } from './ukraine/index';
import { runWarRfUaPipeline } from './war-rf-ua/index';
import { runWorldPipeline } from './world/index';

interface PipelineTask {
  name: string;
  run: (flags: { update: boolean; verbose: boolean }) => Promise<unknown>;
}

const PIPELINES: PipelineTask[] = [
  {
    name: 'ai-tokens',
    run: ({ update, verbose }) => runAiTokensPipeline(update, verbose),
  },
  {
    name: 'ukraine',
    run: ({ update, verbose }) => runUkrainePipeline(update, verbose),
  },
  {
    name: 'world',
    run: ({ update, verbose }) => runWorldPipeline(update, verbose),
  },
  {
    name: 'space-launches',
    run: ({ update, verbose }) => runSpaceLaunchesPipeline(update, verbose),
  },
  {
    name: 'war-rf-ua',
    run: ({ update, verbose }) => runWarRfUaPipeline(update, verbose),
  },
];

/** Executes all ETL data pipelines concurrently and verifies metadata integrity. */
export async function runAllPipelines(options: { update?: boolean; verbose?: boolean } = {}): Promise<void> {
  const verbose = options.verbose ?? isVerbose();
  const forceUpdate = options.update ?? isUpdate();
  const logger = getLogger('pipelines', verbose);

  logger.info(`Starting Parallel Data Pipelines Refresh [${forceUpdate ? 'Force Cache Refresh (-u)' : 'Cache-First / Incremental'}]`);

  const totalStart = Date.now();

  const results = await Promise.allSettled(
    PIPELINES.map(async (p) => {
      const t0 = Date.now();
      try {
        await p.run({ update: forceUpdate, verbose });
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

  const metaPath = getMetadataPath();
  if (await fileExists(metaPath)) {
    try {
      const metadata = await readJson<Record<string, string>>(metaPath);
      logger.debug(`Verified site/public/data/metadata.json (${Object.keys(metadata).length} projects registered)`);
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

if (import.meta.main) {
  runAllPipelines().catch((err) => {
    getLogger('pipelines').error('Fatal execution error:', err);
    process.exit(1);
  });
}
