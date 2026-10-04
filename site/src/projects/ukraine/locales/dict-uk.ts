import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  budgetAndDebt: {
    title: 'Виконання держбюджету та динаміка зовнішнього боргу',
    domesticRevenues: 'Власні доходи',
    defenseSpending: 'Військові видатки',
    nonDefenseSpending: 'Цивільні видатки',
    grants: 'Міжнародні гранти',
    loans: 'Зовнішні запозичення (кредити)',
    externalDebt: 'Валовий зовнішній борг',
    nominalGdp: 'Номінальний ВВП',
    fxRate: 'Курс USD',
    gdp: 'ВВП',
  },
  tradeStructure: {
    title: 'Структура зовнішньої торгівлі товарами (товарообіг)',
    exports: 'Експорт (FOB)',
    imports: 'Імпорт (CIF)',
  },
  tradePartners: {
    title: 'Ключові країни-партнери за товарообігом',
  },
};
