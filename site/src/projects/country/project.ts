import type { CountryProfileData, CountryToolbarMeta } from '@graphs/shared/types/country';
import { CONTROL_DELAYS } from '@/projects/constants';
import { defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import type { State } from '@/utils/store';
import { DEFAULT_COUNTRY_CODE } from './constants';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

const data = {
  meta: () => loadDataset<CountryToolbarMeta>('country', 'toolbar-meta.json'),
};

const sectionData = {
  countryData: (stores?: Record<string, State>) => {
    const code = (stores?.countryStore?.country as string) || DEFAULT_COUNTRY_CODE;
    return loadDataset<CountryProfileData>('country', `${code.toLowerCase()}.json`);
  },
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
      id: 'countryStore',
      scope: 'all',
      controls: [
        {
          id: 'country',
          type: 'single-search-select',
          defaultValue: DEFAULT_COUNTRY_CODE,
          label: t.proj.country,
          items: toolbarMeta.countries.map((code) => ({
            value: code,
            label: fmt.region(code),
            count: toolbarMeta.gdp[code],
          })),
        },
        {
          id: 'years',
          type: 'range-slider',
          min: toolbarMeta.minYear,
          max: toolbarMeta.maxYear,
          defaultValue: toolbarMeta.defaultPeriod,
          label: t.common.period,
          debounceMs: CONTROL_DELAYS.slider,
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
