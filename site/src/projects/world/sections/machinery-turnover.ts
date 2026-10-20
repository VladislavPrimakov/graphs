import { createWorldMetricSection } from '../metric-chart';

/** Section builder for Machinery & Equipment Foreign Trade Turnover chart. */
export const machineryTurnoverSection = createWorldMetricSection(({ t, fmt }) => ({
  id: 'machinery-turnover',
  title: t.proj.machineryTurnover.title,
  unit: `${fmt.scale(1e9)} ($)`,
  sources: [
    { name: 'UN Comtrade — HS Chapter 84 Machinery Trade', url: 'https://comtradeplus.un.org/' },
    { name: 'U.S. BLS — Consumer Price Index (Deflator)', url: 'https://www.bls.gov/cpi/' },
  ],
}));
