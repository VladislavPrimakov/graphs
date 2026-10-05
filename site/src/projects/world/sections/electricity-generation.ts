import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation by Country chart. */
export const electricityGenerationSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'electricity-generation',
    title: ctx.t.proj.electricityGeneration.title,
    chartData: ctx.data.charts.electricityGeneration,
    unit: ctx.fmt.unitName('energy-terawatt-hour'),
  });
