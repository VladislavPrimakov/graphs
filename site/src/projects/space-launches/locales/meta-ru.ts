import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Космические запуски',
  description: 'Семь десятилетий орбитальных пусков: масса полезной нагрузки по странам, стоимость вывода на орбиту ($/кг) и надежность ракет.',
  sections: {
    'payload-capacity': 'Масса на орбиту',
    'launch-costs': 'Стоимость за кг',
    'avg-payload': 'Средняя масса ПН',
    'failure-rates': 'Аварийность пусков',
  },
};
