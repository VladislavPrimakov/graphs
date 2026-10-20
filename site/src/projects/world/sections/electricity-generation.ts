import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation by Country chart. */
export const electricityGenerationSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'electricity-generation',
  title: t.proj.electricityGeneration.title,
  unit: fmt.unitName('energy-terawatt-hour'),
  sources: [
    { name: 'Ember — Global Electricity Review', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
    { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
  ],
}));
