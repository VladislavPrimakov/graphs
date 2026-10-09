import type { LocaleProjectMeta } from '@/types';

export const meta = {
  title: 'World',
  description: 'Comparative macroeconomic and energy analysis: GDP at PPP, machinery trade turnover, electricity generation, and clean power transition.',
  sections: {
    'gdp-ppp': 'GDP (PPP)',
    'gdp-per-capita-ppp': 'GDP per Capita',
    'machinery-turnover': 'Machinery Turnover',
    'electricity-generation': 'Electricity Generation',
    'clean-power': 'Clean Power',
    'electricity-per-capita': 'Electricity per Capita',
  },
} satisfies LocaleProjectMeta;
