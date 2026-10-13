import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Космічні запуски',
  description: 'Сім десятиліть орбітальних пусків: маса корисного навантаження за країнами, вартість виведення ($/кг) та надійність ракет.',
  sections: {
    'payload-capacity': 'Маса на орбіту',
    'avg-payload': 'Середня маса КН',
    'launch-costs': 'Вартість за кг',
    'failure-rates': 'Аварійність пусків',
  },
};
