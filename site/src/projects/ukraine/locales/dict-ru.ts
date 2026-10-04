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
    nominalGdp: 'Номинальный ВВП',
    fxRate: 'Курс USD',
    gdp: 'ВВП',
  },
  tradeStructure: {
    title: 'Структура внешней торговли товарами (товарооборот)',
    exports: 'Экспорт (FOB)',
    imports: 'Импорт (CIF)',
  },
  tradePartners: {
    title: 'Ключевые страны-партнеры по товарообороту',
  },
};
