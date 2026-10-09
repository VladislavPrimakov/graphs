import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Космические запуски',
  description:
    'Исторический анализ орбитальных пусков за семь десятилетий: ежегодная масса выводимой полезной нагрузки по странам, экономика пусков ($/кг на LEO/SSO), средняя масса ПН на пуск и динамика надежности ракет-носителей.',
  sections: {
    'payload-capacity': 'Масса на орбиту',
    'launch-costs': 'Стоимость за кг',
    'avg-payload': 'Средняя масса ПН',
    'failure-rates': 'Аварийность пусков',
  },
};
