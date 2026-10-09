import { writeJson } from '@/utils/fs';
import { updateMetadata } from '@/utils/metadata';
import { getPipelineDataPath, getSiteDataPath, getSiteSectionDataPath } from '@/utils/paths';

export { getPipelineDataPath, getSiteDataPath, getSiteSectionDataPath };

/** Exports a single section dataset JSON to site/public/data/<slug>/<sectionId>/<fileName>. */
export async function exportSectionDataset(slug: string, sectionId: string, dataset: unknown, fileName = 'data.json'): Promise<void> {
  const filePath = getSiteSectionDataPath(slug, sectionId, fileName);
  await writeJson(filePath, dataset, 0);
}

/** Exports all section datasets for a project and updates metadata.json timestamp. */
export async function exportProjectSections(slug: string, sections: Record<string, unknown>): Promise<void> {
  for (const [sectionId, data] of Object.entries(sections)) {
    await exportSectionDataset(slug, sectionId, data);
  }
  await updateMetadata(slug);
}

/** Exports compact dataset JSON to site/public/data/<slug>.json (or custom path) and atomically updates metadata.json timestamp. */
export async function exportDataset(slug: string, dataset: unknown, customPath?: string): Promise<void> {
  const filePath = customPath || getSiteDataPath(slug);
  await writeJson(filePath, dataset, 0);
  await updateMetadata(slug);
}
