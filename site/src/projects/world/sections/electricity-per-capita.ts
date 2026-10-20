import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation per Capita chart. */
export const electricityPerCapitaSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'electricity-per-capita',
  title: t.proj.electricityPerCapita.title,
  unit: fmt.per(fmt.unitName('energy-kilowatt-hour'), 'person'),
  sources: [
    { name: 'Ember — Electricity Generation per Capita', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
    { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
  ],
}));
