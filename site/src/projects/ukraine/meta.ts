import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for Ukraine dashboard. */
export const meta: StaticProjectMeta<'ukraine'> = {
  id: 'ukraine',
  tags: ['economy', 'budget', 'gdp', 'ua'],
  sources: [{ name: 'National Bank of Ukraine', url: 'https://bank.gov.ua/' }],
};
