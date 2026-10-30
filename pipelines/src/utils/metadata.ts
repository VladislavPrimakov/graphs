import fs from 'node:fs/promises';
import { getMetadataPath, writeJsonAsyncToSite } from '@/utils/fs';
import { getLogger } from '@/utils/logger';

export { getMetadataPath };

let writeQueue: Promise<unknown> = Promise.resolve();

/** Updates the last_updated date for project_id in site/public/data/metadata.json safely across concurrent pipelines. */
export async function updateMetadata(projectId: string, dateStr?: string): Promise<string> {
  const finalDate = dateStr || new Date().toISOString().split('T')[0];
  const metaPath = getMetadataPath();

  return new Promise<string>((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        let meta: Record<string, string> = {};
        try {
          const raw = await fs.readFile(metaPath, 'utf-8');
          meta = JSON.parse(raw);
        } catch {
          meta = {};
        }

        meta[projectId] = finalDate;

        const sortedMeta: Record<string, string> = {};
        for (const key of Object.keys(meta).sort()) {
          sortedMeta[key] = meta[key];
        }

        await writeJsonAsyncToSite('metadata.json', sortedMeta);

        getLogger(projectId).debug(`Updated metadata.json: '${finalDate}'`);
        resolve(finalDate);
      } catch (err) {
        reject(err);
      }
    });
  });
}
