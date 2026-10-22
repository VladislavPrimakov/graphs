import type { UkraineDataset } from '@graphs/shared/types/ukraine/data';
import { CONTROL_DELAYS } from '@/projects/constants';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  ukraineData: () => loadDataset<UkraineDataset>('ukraine', 'data.json'),
};

export type Section = ProjectSection<typeof data, typeof dict>;

/** Project specification for Ukraine macroeconomic dynamics dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ ukraineData }, { t }) => [
    {
      id: 'ukraineStore',
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
          min: ukraineData.minYear,
          max: ukraineData.maxYear,
          defaultValue: ukraineData.defaultPeriod,
          label: t.common.period,
          debounceMs: CONTROL_DELAYS.slider,
        },
      ],
    },
  ],
});
