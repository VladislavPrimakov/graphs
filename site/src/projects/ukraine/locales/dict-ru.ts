import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  budgetAndDebt: {
    title: 'Исполнение госбюджета и динамика внешнего долга',
    domesticRevenues: 'Собственные доходы',
    defenseSpending: 'Военные расходы',
    nonDefenseSpending: 'Гражданские расходы',
    grants: 'Международные гранты',
    loans: 'Внешние заимствования (кредиты)',
    externalDebt: 'Валовой внешний долг',
    govDebt: 'Государственный внешний долг',
    privateDebt: 'Частный внешний долг',
    nominalGdp: 'Номинальный ВВП',
    fxRate: 'Курс USD',
    gdp: 'ВВП',
  },
  tradeStructure: {
    title: 'Структура внешней торговли (товары и услуги)',
    exports: 'Экспорт',
    imports: 'Импорт',
  },
  tradePartners: {
    title: 'Ключевые страны-партнеры (товары и IT-услуги)',
  },
  tradeCategories: {
    title: 'Структура торговли по категориям (товары и услуги)',
    agriculture: 'Агро',
    minerals: 'Минералы',
    chemicals: 'Химия',
    timber: 'Древесина',
    manufactured: 'Промтовары',
    metals: 'Металлы',
    machinery: 'Машины',
    unclassified_goods: 'Спецтовары и неформальный ввоз',
    it_services: 'IT и телеком',
    transport_services: 'Транспорт',
    travel: 'Поездки',
    business_services: 'Деловые услуги',
    other: 'Прочее',
  },
};
