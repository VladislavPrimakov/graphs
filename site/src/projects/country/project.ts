import type { CountryProfileData, CountryToolbarMeta } from '@graphs/types/country';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { State } from '@/utils/store';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  meta: () => loadDataset<CountryToolbarMeta>('country', 'toolbar-meta.json'),
};

const sectionData = {
  country: (stores?: Record<string, State>) => {
    const code = (stores?.country?.select as string) || 'us';
    return loadDataset<CountryProfileData>('country', `${code.toLowerCase()}.json`);
  },
  meta: () => loadDataset<CountryToolbarMeta>('country', 'toolbar-meta.json'),
};

export type Section = ProjectSection<typeof sectionData, typeof dict>;

/** Project specification for Country macroeconomic dynamics and trade dashboard. */
export const project = defineProject<typeof dict, typeof data, typeof sectionData>({
  meta,
  data,
  sectionData,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ meta: toolbarMeta }, { t, fmt }) => [
    {
      id: 'country',
      scope: 'all',
      controls: [
        {
          id: 'select',
          type: 'single-search-select',
          defaultValue: 'us',
          label: t.proj.country,
          items: toolbarMeta.countries.map((code) => ({
            value: code,
            label: fmt.region(code),
            count: toolbarMeta.gdp[code],
          })),
        },
        {
          id: 'period',
          type: 'range-slider',
          min: toolbarMeta.minYear,
          max: toolbarMeta.maxYear,
          defaultValue: toolbarMeta.defaultPeriod,
          label: t.common.period,
        },
        {
          id: 'labels',
          type: 'checkbox',
          defaultValue: true,
          label: t.common.labels,
        },
      ],
    },
  ],
});
