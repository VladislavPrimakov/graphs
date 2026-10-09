import type { ElectricityPerCapitaSectionData } from '@graphs/types/world/electricity-per-capita';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation per Capita chart. */
export const electricityPerCapitaSection: SectionBuilder<ElectricityPerCapitaSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'electricity-per-capita',
    title: ctx.t.proj.electricityPerCapita.title,
    unit: ctx.fmt.per(ctx.fmt.unitName('energy-kilowatt-hour'), 'person'),
    sources: [
      { name: 'Ember — Electricity Generation per Capita', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
      { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
    ],
  });
