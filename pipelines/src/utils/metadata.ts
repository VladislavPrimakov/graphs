import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectSlug } from '@/types';
import { getLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Returns the absolute path to site/src/data/metadata.json. */
export function getMetadataPath(): string {
  return path.resolve(__dirname, '../../../site/src/data/metadata.json');
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Updates the last_updated date for project_id in site/src/data/metadata.json safely across concurrent pipelines. */
export async function updateMetadata(projectId: ProjectSlug, dateStr?: string): Promise<string> {
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

        await fs.mkdir(path.dirname(metaPath), { recursive: true });
        await fs.writeFile(metaPath, `${JSON.stringify(sortedMeta)}\n`, 'utf-8');
        getLogger(projectId).debug(`Updated metadata.json: '${finalDate}'`);
        resolve(finalDate);
      } catch (err) {
        reject(err);
      }
    });
  });
}
