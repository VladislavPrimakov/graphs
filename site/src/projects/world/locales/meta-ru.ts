import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Мир',
  description:
    'Сравнительный анализ макроэкономики, промышленности, энергетики и автомобилизации: ВВП по ППС, обрабатывающая промышленность, выработка электроэнергии, чистая энергетика и легковые автомобили.',
  sections: {
    'gdp-ppp': 'ВВП (ППС)',
    'gdp-per-capita-ppp': 'ВВП на душу',
    'manufacturing-per-capita': 'Обрабатывающая промышленность',
    'electricity-generation': 'Выработка энергии',
    'clean-power': 'Чистая энергетика',
    'electricity-per-capita': 'Энергия на душу',
    'passenger-cars': 'Автомобили',
  },
};
