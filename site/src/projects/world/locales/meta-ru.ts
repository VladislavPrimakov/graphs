import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Мир',
  description:
    'Сравнительный макроэкономический и энергетический анализ ведущих экономик мира: ВВП по ППС (валовой и на душу населения), товарооборот машиностроения и электроники (HS 84-85), выработка электроэнергии, развитие солнечной и ветровой генерации и удельное энергопотребление.',
  sections: {
    'gdp-ppp': 'ВВП (ППС)',
    'gdp-per-capita-ppp': 'ВВП на душу',
    'machinery-turnover': 'Торговля машинами',
    'electricity-generation': 'Выработка энергии',
    'clean-power': 'Чистая энергетика',
    'electricity-per-capita': 'Энергия на душу',
  },
};
