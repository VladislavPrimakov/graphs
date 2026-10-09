import type { LocaleProjectMeta } from '@/types';

export const meta = {
  title: 'World',
  description:
    'Comparative macroeconomic and energy analysis across top world economies: GDP at PPP (total and per capita), machinery and electronics trade turnover (HS 84-85), gross electricity generation, clean solar & wind power transition, and per capita power consumption.',
  sections: {
    'gdp-ppp': 'GDP (PPP)',
    'gdp-per-capita-ppp': 'GDP per Capita',
    'machinery-turnover': 'Machinery Turnover',
    'electricity-generation': 'Electricity Generation',
    'clean-power': 'Clean Power',
    'electricity-per-capita': 'Electricity per Capita',
  },
} satisfies LocaleProjectMeta;
