import { writeJsonAsync } from '@/utils/fs';
import { updateMetadata } from '@/utils/metadata';
import { getPipelineDataPath, getSiteDataPath, getSiteProjectMetaPath } from '@/utils/paths';

export { getPipelineDataPath, getSiteDataPath, getSiteProjectMetaPath };

/** Exports a project dataset JSON directly to site/public/data/<slug>/<fileName>. */
export async function exportDataset(slug: string, dataset: unknown, fileName = 'data.json'): Promise<void> {
  const filePath = getSiteDataPath(slug, fileName);
  await writeJsonAsync(filePath, dataset);
  await updateMetadata(slug);
}

/** Exports project-level toolbar metadata JSON to site/public/data/<slug>/<fileName>. */
export async function exportProjectMeta(slug: string, metadata: unknown, fileName = 'toolbar-meta.json'): Promise<void> {
  const filePath = getSiteProjectMetaPath(slug, fileName);
  await writeJsonAsync(filePath, metadata);
}
