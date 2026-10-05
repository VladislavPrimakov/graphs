import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Electricity Generation per Capita chart. */
export const electricityPerCapitaSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'electricity-per-capita',
    title: ctx.t.proj.electricityPerCapita.title,
    chartData: ctx.data.charts.electricityPerCapita,
    unit: ctx.fmt.per(ctx.fmt.unitName('energy-kilowatt-hour'), 'person'),
  });
