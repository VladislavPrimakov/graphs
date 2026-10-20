import type { UkraineDataset } from '@graphs/types/ukraine/data';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  ukraine: () => loadDataset<UkraineDataset>('ukraine', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict>;

/** Project specification for Ukraine macroeconomic dynamics dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ ukraine }, { t }) => [
    {
      id: 'ukraine',
      scope: 'all',
      controls: [
        {
          id: 'labels',
          type: 'checkbox',
          defaultValue: true,
          label: t.common.labels,
        },
        {
          id: 'years',
          type: 'range-slider',
          min: ukraine.minYear,
          max: ukraine.maxYear,
          defaultValue: ukraine.defaultPeriod,
          label: t.common.period,
        },
      ],
    },
  ],
});
