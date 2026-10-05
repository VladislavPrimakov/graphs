import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for Ukraine dashboard. */
export const meta = {
  id: 'ukraine',
  tags: ['economy', 'budget', 'gdp', 'ua'],
  sources: [{ name: 'National Bank of Ukraine', url: 'https://bank.gov.ua/' }],
  sections: ['budget-and-debt', 'trade-structure', 'trade-partners', 'trade-categories'],
} as const satisfies StaticProjectMeta<'ukraine'>;
