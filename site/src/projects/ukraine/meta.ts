import type { ProjectManifest } from '@/utils/project';

/** Static metadata descriptor for Ukraine dashboard. */
export const meta = {
  id: 'ukraine',
  tags: ['economy', 'budget', 'gdp', 'ua'],
  sections: ['macro', 'macro-growth', 'trade-structure', 'trade-partners', 'trade-categories'],
} as const satisfies ProjectManifest;
