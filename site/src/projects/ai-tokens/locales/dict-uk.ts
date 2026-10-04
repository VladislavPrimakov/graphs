import type { dict as dictEn } from './dict-en';

export const dict = {
  tokensByRegion: {
    title: 'Глобальне споживання токенів за регіонами (NDB та OpenRouter)',
    kpis: {
      peakDaily: 'Піковий обсяг',
      topRegion: 'Лідер за обсягом',
    },
  },
  tokensByCompany: {
    title: 'Споживання токенів за ШІ-провайдерами (розкриття та оцінки)',
  },
} satisfies typeof dictEn;
