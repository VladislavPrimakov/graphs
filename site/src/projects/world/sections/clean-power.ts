import type { CleanPowerSectionData } from '@graphs/types/world/clean-power';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Clean Power Generation (Renewables & Nuclear) chart. */
export const cleanPowerSection: SectionBuilder<CleanPowerSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'clean-power',
    title: ctx.t.proj.cleanPower.title,
    unit: ctx.fmt.unitName('energy-terawatt-hour'),
    sources: [
      { name: 'Ember — Global Electricity Review (Solar & Wind)', url: 'https://ember-climate.org/data/data-tools/data-explorer/' },
      { name: 'Our World in Data — Energy Dataset', url: 'https://github.com/owid/energy-data' },
    ],
  });
