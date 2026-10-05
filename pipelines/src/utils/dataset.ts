import type { ProjectSlug } from '@graphs/types';
import { writeJson } from '@/utils/fs';
import { updateMetadata } from '@/utils/metadata';
import { getPipelineDataPath, getSiteDataPath } from '@/utils/paths';

export { getPipelineDataPath, getSiteDataPath };

/** Exports compact dataset JSON to site/src/data/<slug>.json (or custom path) and atomically updates metadata.json timestamp. */
export async function exportDataset(slug: ProjectSlug, dataset: unknown, customPath?: string): Promise<void> {
  const filePath = customPath || getSiteDataPath(slug);
  await writeJson(filePath, dataset, 0);
  await updateMetadata(slug);
}
