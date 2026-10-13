import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Космические запуски',
  description: 'Семь десятилетий орбитальных пусков: масса полезной нагрузки по странам, стоимость вывода на орбиту ($/кг) и надежность ракет.',
  sections: {
    'payload-capacity': 'Масса на орбиту',
    'avg-payload': 'Средняя масса ПН',
    'launch-costs': 'Стоимость за кг',
    'failure-rates': 'Аварийность пусков',
  },
};
