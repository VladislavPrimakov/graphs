import type { WorldDataset, WorldFilterState } from '@graphs/types/world';
import { createElement } from 'react';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  world: () => loadDataset<WorldDataset>('world', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict, { world: WorldFilterState }>;

/** Project specification for World Economic & Energy Indicators dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ world }, { t, fmt }) => [
    {
      id: 'world',
      scope: 'all',
      controls: [
        {
          id: 'years',
          type: 'range-slider',
          min: world.minYear,
          max: world.maxYear,
          defaultValue: [world.minYear, world.maxYear],
          label: t.common.period,
        },
        {
          id: 'top',
          type: 'slider',
          min: world.minTop,
          max: world.maxTop,
          defaultValue: world.defaultTop,
          label: t.common.top,
          disabled: (state) => ((state.countries as string[])?.length ?? 0) > 0,
        },
        {
          id: 'countries',
          type: 'multi-search-select',
          placeholder: t.proj.countries,
          emptyLabel: t.proj.noCountriesFound,
          items: world.entities.map((code) => ({
            value: code,
            label: fmt.region(code),
            icon: createElement('span', { className: 'font-mono text-[10px] opacity-75' }, code),
          })),
        },
      ],
    },
  ],
});
