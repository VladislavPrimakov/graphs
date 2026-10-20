import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP (PPP) by Country chart. */
export const gdpPppSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'gdp-ppp',
  title: t.proj.gdpPpp.title,
  unit: `${fmt.scale(1e12)} ($)`,
  sources: [
    { name: 'World Bank — GDP, PPP (constant 2021 int$)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.PP.KD' },
    { name: 'IMF — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
  ],
}));
