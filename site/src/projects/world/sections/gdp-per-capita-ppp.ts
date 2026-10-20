import { createWorldMetricSection } from '../metric-chart';

/** Section builder for GDP per Capita (PPP) by Country chart. */
export const gdpPerCapitaPppSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'gdp-per-capita-ppp',
  title: t.proj.gdpPerCapita.title,
  unit: fmt.per('Int$', 'person'),
  sources: [
    { name: 'World Bank — GDP per capita, PPP (constant 2021 int$)', url: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD' },
    { name: 'IMF — World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
  ],
}));
