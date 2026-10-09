import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Космічні запуски',
  description:
    'Історичний аналіз орбітальних польотів за сім десятиліть: щорічна маса корисного навантаження на орбіті за країнами, економіка запуску ($/кг на НОО/ССО), середня маса на запуск та динаміка надійності.',
  sections: {
    'payload-capacity': 'Маса на орбіту',
    'launch-costs': 'Вартість за кг',
    'avg-payload': 'Середня маса КН',
    'failure-rates': 'Аварійність пусків',
  },
};
