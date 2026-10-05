import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Clean Power Generation (Renewables & Nuclear) chart. */
export const cleanPowerSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'clean-power',
    title: ctx.t.proj.cleanPower.title,
    chartData: ctx.data.charts.cleanPower,
    unit: ctx.fmt.unitName('energy-terawatt-hour'),
  });
