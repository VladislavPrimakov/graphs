import type { WorldDataset, WorldFilterState } from '@graphs/shared/types/world';
import { createElement } from 'react';
import { CONTROL_DELAYS } from '@/projects/constants';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  worldData: () => loadDataset<WorldDataset>('world', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict, { worldStore: WorldFilterState }>;

/** Project specification for World Economic & Energy Indicators dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ worldData }, { t, fmt }) => [
    {
      id: 'worldStore',
      scope: 'all',
      controls: [
        {
          id: 'years',
          type: 'range-slider',
          min: worldData.minYear,
          max: worldData.maxYear,
          defaultValue: [worldData.minYear, worldData.maxYear],
          label: t.common.period,
          debounceMs: CONTROL_DELAYS.slider,
        },
        {
          id: 'top',
          type: 'slider',
          min: worldData.minTop,
          max: worldData.maxTop,
          defaultValue: worldData.defaultTop,
          label: t.common.top,
          disabled: (state) => ((state.countries as string[])?.length ?? 0) > 0,
          debounceMs: CONTROL_DELAYS.slider,
        },
        {
          id: 'countries',
          type: 'multi-search-select',
          placeholder: t.proj.countries,
          emptyLabel: t.proj.noCountriesFound,
          items: worldData.entities.map((code) => ({
            value: code,
            label: fmt.region(code),
            icon: createElement('span', { className: 'font-mono text-3xs opacity-75' }, code),
          })),
        },
      ],
    },
  ],
});
