import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Війна РФ-Україна',
  description:
    'Комплексна база даних втрат військової техніки РФ та України (понад 19 000 верифікованих фото/відео епізодів з геолокацією у 14 категоріях) та динаміка далекобійних повітряних ударів БПЛА й ракетами з перехопленнями ППО.',
  sections: {
    'frontline-map': 'Карта територій',
    'frontline-dynamics': 'Динаміка фронту',
    'losses-map': 'Карта втрат',
    'losses-timeline': 'Динаміка втрат',
    'category-losses': 'Втрати за категоріями',
    'equipment-breakdown': 'Розподіл за моделями',
    'uav-strikes': 'Атаки БПЛА',
    'missile-strikes': 'Ракетні удари',
  },
};
