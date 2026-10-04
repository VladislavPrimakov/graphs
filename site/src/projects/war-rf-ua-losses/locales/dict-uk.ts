import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  timeline: {
    title: 'Помісячна динаміка підтверджених втрат техніки',
    losses: 'Втрати',
    totalRecords: 'Всього записів у базі',
    unrecognized: 'нерозпізнано',
    monthTotal: 'Разом (місяць)',
  },
  categories: {
    title: 'Підтверджені втрати техніки за категоріями',
    items: {
      tanks: 'Танки',
      ifv: 'БМП, БТР, БМД',
      transport: 'Вантажівки та транспорт',
      sp_artillery: 'САУ',
      air_defense: 'ППО',
      mlrs: 'РСЗВ',
      towed_artillery: 'Буксирувана артилерія',
      engineering: 'Інженерна техніка',
      radars_jammers: 'РЛС та РЕБ',
      airplanes: 'Літаки',
      helicopters: 'Гелікоптери',
      vessels: 'Кораблі та катери',
      imv: 'Бронеавтомобілі (MRAP)',
      anti_tank: 'ПТРК',
    },
  },
  map: {
    title: 'Геолокована карта втрат техніки',
    subtitle: 'Інтерактивна візуалізація понад 19 000 фото- та відеопідтверджених втрат техніки',
    allSides: 'Всі сторони',
    allCategories: 'Всі категорії',
    searchPlaceholder: 'Пошук моделі (напр. T-90M, BMP-3, Ka-52)...',
    selectedModels: 'Обрані моделі',
    noModelsFound: 'Моделей не знайдено',
    losses: 'підтверджених втрат',
    model: 'Модель',
    side: 'Сторона',
    coordinates: 'Координати',
  },
};
