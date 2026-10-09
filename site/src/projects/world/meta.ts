import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for World dashboard. */
export const meta = {
  id: 'world',
  tags: ['global', 'economy', 'gdp', 'energy', 'industry'],
  sections: ['gdp-ppp', 'gdp-per-capita-ppp', 'machinery-turnover', 'electricity-generation', 'clean-power', 'electricity-per-capita'],
} as const satisfies StaticProjectMeta<'world'>;
