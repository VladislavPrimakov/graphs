import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  countries: 'Страны',
  noCountriesFound: 'Страны не найдены',
  gdpPpp: {
    title: 'ВВП по ППС (в ценах 2021 г.)',
  },
  gdpPerCapita: {
    title: 'ВВП на душу населения по ППС (в ценах 2021 г.)',
  },
  manufacturingPerCapita: {
    title: 'Выпуск обрабатывающей промышленности на душу (в ценах 2021 г.)',
  },
  electricityGeneration: {
    title: 'Валовая генерация электроэнергии',
  },
  cleanPower: {
    title: 'Генерация солнечной и ветровой энергии',
  },
  electricityPerCapita: {
    title: 'Потребление электроэнергии на душу населения',
  },
  passengerCars: {
    title: 'Легковые автомобили на 1 000 человек',
  },
};
