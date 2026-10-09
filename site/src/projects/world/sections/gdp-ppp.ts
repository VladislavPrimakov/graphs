import type { GdpPppSectionData } from '@graphs/types/world/gdp-ppp';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP (PPP) by Country chart. */
export const gdpPppSection: SectionBuilder<GdpPppSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'gdp-ppp',
    title: ctx.t.proj.gdpPpp.title,
    unit: `${ctx.fmt.scale(1e12)} ($)`,
    sources: [
      { name: 'World Bank — GDP, PPP (constant 2021 int$)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.PP.KD' },
      { name: 'IMF — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
    ],
  });
