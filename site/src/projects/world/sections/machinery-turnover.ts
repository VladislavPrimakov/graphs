import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Machinery & Equipment Foreign Trade Turnover chart. */
export const machineryTurnoverSection: SectionBuilder<'world', typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'machinery-turnover',
    title: ctx.t.proj.machineryTurnover.title,
    chartData: ctx.data.charts.machineryTurnover,
    unit: `${ctx.fmt.scale(1e9)} ($)`,
  });
