import type { GdpPerCapitaPppSectionData } from '@graphs/types/world/gdp-per-capita-ppp';
import type { SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';
import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP per Capita (PPP) by Country chart. */
export const gdpPerCapitaPppSection: SectionBuilder<GdpPerCapitaPppSectionData, typeof dict> = (ctx) =>
  createWorldMetricSection(ctx, {
    id: 'gdp-per-capita-ppp',
    title: ctx.t.proj.gdpPerCapita.title,
    unit: ctx.fmt.per('Int$', 'person'),
    sources: [
      { name: 'World Bank — GDP per capita, PPP (constant 2021 int$)', url: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD' },
      { name: 'IMF — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
    ],
  });
