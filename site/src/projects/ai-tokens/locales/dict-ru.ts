import type { dict as dictEn } from './dict-en';

export const dict = {
  tokensByRegion: {
    title: 'Мировое потребление токенов по регионам (NDB и OpenRouter)',
    kpis: {
      peakDaily: 'Пиковый объем',
      topRegion: 'Лидер по объему',
    },
  },
  tokensByCompany: {
    title: 'Потребление токенов по AI-провайдерам (раскрытия и оценки)',
  },
} satisfies typeof dictEn;
