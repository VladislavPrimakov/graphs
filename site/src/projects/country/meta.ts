import type { ProjectManifest } from '@/utils/project';

/** Static metadata descriptor for Country dashboard. */
export const meta = {
  id: 'country',
  tags: ['global', 'economy', 'budget', 'gdp'],
  sections: ['macro', 'macro-growth', 'trade-structure', 'trade-categories', 'trade-partners'],
} as const satisfies ProjectManifest;
