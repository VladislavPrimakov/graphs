import type { SpaceLaunchesDataset } from '@graphs/types/space-launches/data';
import { createElement } from 'react';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  spaceLaunches: () => loadDataset<SpaceLaunchesDataset>('space-launches', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict>;

/** Project specification for orbital space launches dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ spaceLaunches }, { t, fmt }) => [
    {
      id: 'launches',
      scope: 'all',
      controls: [
        {
          id: 'countries',
          type: 'multi-search-select',
          placeholder: t.proj.countries,
          emptyLabel: t.proj.noCountriesFound,
          allLabel: t.proj.allCountries,
          allCount: spaceLaunches.totalLaunches,
          items: spaceLaunches.entities.map((e) => ({
            value: e.code,
            label: fmt.region(e.code),
            count: e.launches,
            icon: createElement('span', { className: 'font-mono text-[10px] opacity-75' }, e.code),
          })),
        },
      ],
    },
  ],
});
