import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  countries: 'Країни',
  searchCountry: 'Пошук країни',
  noCountriesFound: 'Країни не знайдені',
  gdpPpp: {
    title: 'ВВП за ПКС (у цінах 2021 р.)',
  },
  gdpPerCapita: {
    title: 'ВВП на душу населення за ПКС (у цінах 2021 р.)',
  },
  electricityGeneration: {
    title: 'Валова генерація електроенергії',
  },
  cleanPower: {
    title: 'Генерація сонячної та вітрової енергії',
  },
  electricityPerCapita: {
    title: 'Споживання електроенергії на душу населення',
  },
  passengerCars: {
    title: 'Легкові автомобілі на 1 000 осіб',
  },
};
