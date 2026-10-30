import type { ProjectLocaleMeta } from '@/utils/project';

export const meta = {
  title: 'Country',
  description: 'Sovereign macroeconomic profiles, government budget, debt, foreign trade balance, and partner nations based on UN Comtrade and IMF WEO.',
  sections: {
    macro: 'Macro',
    'macro-growth': 'Growth',
    'trade-structure': 'Trade Structure',
    'trade-categories': 'Trade Categories',
    'trade-partners': 'Trade Partners',
  },
} satisfies ProjectLocaleMeta;
