import type { ProjectManifest } from '@/utils/project';

/** Static metadata descriptor for World dashboard. */
export const meta = {
  id: 'world',
  tags: ['global', 'economy', 'gdp', 'energy', 'industry'],
  sections: ['gdp-ppp', 'gdp-per-capita-ppp', 'manufacturing-per-capita', 'electricity-generation', 'clean-power', 'electricity-per-capita', 'passenger-cars'],
} as const satisfies ProjectManifest;
