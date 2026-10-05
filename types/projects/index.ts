import type { AiTokensDataset } from './ai-tokens';
import type { SpaceLaunchesDataset } from './space-launches';
import type { UkraineDataset } from './ukraine';
import type { WarAttacksDataset } from './war-rf-ua-attacks';
import type { WarLossesDataset } from './war-rf-ua-losses';
import type { WorldDataset } from './world';

export * from './ai-tokens';
export * from './space-launches';
export * from './ukraine';
export * from './war-rf-ua-attacks';
export * from './war-rf-ua-losses';
export * from './world';

/** Canonical registry of all project slug identifiers in the catalog. */
export const PROJECT_SLUGS = ['ai-tokens', 'ukraine', 'world', 'space-launches', 'war-rf-ua-attacks', 'war-rf-ua-losses'] as const;

/** Union of all valid unique URL slugs for interactive visualization projects. */
export type ProjectSlug = (typeof PROJECT_SLUGS)[number];

/** Map of project slug identifiers to their strongly typed raw dataset payloads. */
export interface ProjectDataMap extends Record<ProjectSlug, unknown> {
  'ai-tokens': AiTokensDataset;
  ukraine: UkraineDataset;
  world: WorldDataset;
  'space-launches': SpaceLaunchesDataset;
  'war-rf-ua-attacks': WarAttacksDataset;
  'war-rf-ua-losses': WarLossesDataset;
}

/** Union of all typed dataset payloads across the catalog projects. */
export type ProjectDataset = ProjectDataMap[ProjectSlug];
