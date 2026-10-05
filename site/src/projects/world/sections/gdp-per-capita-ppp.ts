import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP per Capita (PPP) by Country chart. */
export const gdpPerCapitaPppSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'gdp-per-capita-ppp',
    title: ctx.t.proj.gdpPerCapita.title,
    chartData: ctx.data.charts.gdpPerCapitaPpp,
    unit: ctx.fmt.per('Int$', 'person'),
  });
