import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Мир',
  description: 'Сравнительный анализ макроэкономики, промышленности, энергетики и автопарка: ВВП по ППС, промпроизводство, генерация энергии, чистая энергия и легковые авто.',
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
