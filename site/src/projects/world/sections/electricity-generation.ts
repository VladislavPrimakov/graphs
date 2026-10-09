import type { ElectricityGenerationSectionData } from '@graphs/types/world/electricity-generation';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation by Country chart. */
export const electricityGenerationSection: SectionBuilder<ElectricityGenerationSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'electricity-generation',
    title: ctx.t.proj.electricityGeneration.title,
    unit: ctx.fmt.unitName('energy-terawatt-hour'),
    sources: [
      { name: 'Ember — Global Electricity Review', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
      { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
    ],
  });
