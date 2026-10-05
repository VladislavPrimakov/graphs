import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP (PPP) by Country chart. */
export const gdpPppSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'gdp-ppp',
    title: ctx.t.proj.gdpPpp.title,
    chartData: ctx.data.charts.gdpPpp,
    unit: `${ctx.fmt.scale(1e12)} ($)`,
  });
