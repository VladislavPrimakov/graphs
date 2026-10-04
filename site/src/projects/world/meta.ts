import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for World dashboard. */
export const meta: StaticProjectMeta<'world'> = {
  id: 'world',
  tags: ['global', 'economy', 'gdp', 'energy', 'industry'],
  sources: [
    { name: 'World Bank Open Data', url: 'https://data.worldbank.org/' },
    { name: 'UN Comtrade Database', url: 'https://comtradeplus.un.org/' },
    { name: 'Ember Global Electricity Review', url: 'https://ember-climate.org/' },
  ],
};
