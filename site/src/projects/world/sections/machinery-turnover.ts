import type { MachineryTurnoverSectionData } from '@graphs/types/world/machinery-turnover';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Machinery & Equipment Foreign Trade Turnover chart. */
export const machineryTurnoverSection: SectionBuilder<MachineryTurnoverSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'machinery-turnover',
    title: ctx.t.proj.machineryTurnover.title,
    unit: `${ctx.fmt.scale(1e9)} ($)`,
    sources: [
      { name: 'UN Comtrade — HS Chapter 84 Machinery Trade', url: 'https://comtradeplus.un.org/' },
      { name: 'U.S. BLS — Consumer Price Index (Deflator)', url: 'https://www.bls.gov/cpi/' },
    ],
  });
