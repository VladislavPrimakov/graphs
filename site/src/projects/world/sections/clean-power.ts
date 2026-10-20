import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Clean Power Generation (Renewables & Nuclear) chart. */
export const cleanPowerSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'clean-power',
  title: t.proj.cleanPower.title,
  unit: fmt.unitName('energy-terawatt-hour'),
  sources: [
    { name: 'Ember — Global Electricity Review (Solar & Wind)', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
    { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
  ],
}));
