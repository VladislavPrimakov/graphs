import type { ProjectLocaleMeta } from '@/utils/project';

export const meta = {
  title: 'World',
  description: 'Comparative macroeconomic, energy, and motorization indicators: GDP at PPP, electricity generation, clean power, and passenger cars.',
  sections: {
    'gdp-ppp': 'GDP (PPP)',
    'gdp-per-capita-ppp': 'GDP per Capita',
    'electricity-generation': 'Electricity Generation',
    'clean-power': 'Clean Power',
    'electricity-per-capita': 'Electricity per Capita',
    'passenger-cars': 'Passenger Cars',
  },
} satisfies ProjectLocaleMeta;
