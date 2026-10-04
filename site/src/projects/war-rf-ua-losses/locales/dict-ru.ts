import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  timeline: {
    title: 'Помесячная динамика подтверждённых потерь техники',
    losses: 'Потери',
    totalRecords: 'Всего записей в базе',
    unrecognized: 'нераспознано',
    monthTotal: 'Итого (месяц)',
  },
  categories: {
    title: 'Подтверждённые потери техники по категориям',
    items: {
      tanks: 'Танки',
      ifv: 'БМП, БТР, БМД',
      transport: 'Грузовики и транспорт',
      sp_artillery: 'САУ',
      air_defense: 'ПВО',
      mlrs: 'РСЗО',
      towed_artillery: 'Буксируемая артиллерия',
      engineering: 'Инженерная техника',
      radars_jammers: 'РЛС и РЭБ',
      airplanes: 'Самолеты',
      helicopters: 'Вертолеты',
      vessels: 'Корабли и катера',
      imv: 'Бронеавтомобили (MRAP)',
      anti_tank: 'ПТРК',
    },
  },
  map: {
    title: 'Геолоцированная карта потерь техники',
    subtitle: 'Интерактивная визуализация более 19 000 фото- и видеоподтверждённых потерь техники',
    allSides: 'Все стороны',
    allCategories: 'Все категории',
    searchPlaceholder: 'Поиск модели (напр. T-90M, BMP-3, Ka-52)...',
    selectedModels: 'Выбранные модели',
    noModelsFound: 'Модели не найдены',
    losses: 'подтверждённых потерь',
    model: 'Модель',
    side: 'Сторона',
    coordinates: 'Координаты',
  },
};
