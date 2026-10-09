import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Світ',
  description:
    'Порівняльний макроекономічний та енергетичний аналіз провідних економік світу: ВВП за ПКС (загальний та на душу населення), товарообіг машинобудування й електроніки (HS 84-85), валова генерація електроенергії, перехід на чисту сонячну й вітрову енергію та споживання на душу населення.',
  sections: {
    'gdp-ppp': 'ВВП (ПКС)',
    'gdp-per-capita-ppp': 'ВВП на душу',
    'machinery-turnover': 'Торгівля машинами',
    'electricity-generation': 'Виробництво енергії',
    'clean-power': 'Чиста енергетика',
    'electricity-per-capita': 'Енергія на душу',
  },
};
