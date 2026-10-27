import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Світ',
  description:
    'Порівняльний аналіз макроекономіки, промисловості, енергетики та автомобілізації: ВВП за ПКС, обробна промисловість, виробництво електроенергії, чиста енергетика та легкові автомобілі.',
  sections: {
    'gdp-ppp': 'ВВП (ПКС)',
    'gdp-per-capita-ppp': 'ВВП на душу',
    'manufacturing-per-capita': 'Обробна промисловість',
    'electricity-generation': 'Виробництво енергії',
    'clean-power': 'Чиста енергетика',
    'electricity-per-capita': 'Енергія на душу',
    'passenger-cars': 'Автомобілі',
  },
};
