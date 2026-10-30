import type { WorldToolbarMeta } from '@graphs/shared/types/world';
import { createElement } from 'react';
import { CONTROL_DELAYS } from '@/projects/constants';
import { defineProject, loadDataset } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  toolbarMeta: () => loadDataset<WorldToolbarMeta>('world', 'toolbar-meta.json'),
};

/** Project specification for World Economic & Energy Indicators dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ toolbarMeta }, { t, fmt }) => [
    {
      id: 'worldStore',
      scope: 'all',
      controls: [
        {
          id: 'mode',
          type: 'toggle',
          defaultValue: 'volume',
          label: t.common.metric,
          options: [
            { value: 'volume', label: t.common.volume },
            { value: 'growth', label: `${t.common.growth} (%)` },
          ],
        },
        {
          id: 'years',
          type: 'range-slider',
          min: toolbarMeta.minYear,
          max: toolbarMeta.maxYear,
          defaultValue: [toolbarMeta.minYear, toolbarMeta.maxYear],
          label: t.common.period,
          debounceMs: CONTROL_DELAYS.slider,
        },
        {
          id: 'top',
          type: 'slider',
          min: toolbarMeta.minTop,
          max: toolbarMeta.maxTop,
          defaultValue: toolbarMeta.defaultTop,
          label: t.common.top,
          disabled: (state) => ((state.countries as string[])?.length ?? 0) > 0,
          debounceMs: CONTROL_DELAYS.slider,
        },
        {
          id: 'countries',
          type: 'multi-search-select',
          placeholder: t.proj.countries,
          emptyLabel: t.proj.noCountriesFound,
          formatCount: (val: number) => fmt.currency(val * 1e9),
          items: () =>
            toolbarMeta.entities.map((code) => ({
              value: code,
              label: fmt.region(code),
              count: toolbarMeta.gdp?.[code],
              icon: createElement('span', { className: 'font-mono text-3xs opacity-75' }, code),
            })),
        },
      ],
    },
  ],
});
