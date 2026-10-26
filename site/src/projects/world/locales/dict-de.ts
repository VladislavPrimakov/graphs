import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  countries: 'Länder',
  searchCountry: 'Land suchen',
  noCountriesFound: 'Keine Länder gefunden',
  gdpPpp: {
    title: 'BIP nach KKP (konstante Preise 2021 $)',
  },
  gdpPerCapita: {
    title: 'BIP pro Kopf nach KKP (konstante Preise 2021 $)',
  },
  electricityGeneration: {
    title: 'Bruttostromerzeugung',
  },
  cleanPower: {
    title: 'Solar- & Windstromerzeugung',
  },
  electricityPerCapita: {
    title: 'Stromverbrauch pro Kopf',
  },
  passengerCars: {
    title: 'Personenkraftwagen pro 1.000 Einwohner',
  },
};
