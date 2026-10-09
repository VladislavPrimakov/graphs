import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for Ukraine dashboard. */
export const meta = {
  id: 'ukraine',
  tags: ['economy', 'budget', 'gdp', 'ua'],
  sections: ['budget-and-debt', 'trade-structure', 'trade-partners', 'trade-categories'],
} as const satisfies StaticProjectMeta<'ukraine'>;
