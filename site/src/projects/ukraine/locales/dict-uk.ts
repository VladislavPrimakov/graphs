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
    govDebt: 'Державний зовнішній борг',
    privateDebt: 'Приватний зовнішній борг',
    nominalGdp: 'Номінальний ВВП',
    fxRate: 'Курс USD',
    gdp: 'ВВП',
  },
  tradeStructure: {
    title: 'Структура зовнішньої торгівлі (товари та послуги)',
    exports: 'Експорт',
    imports: 'Імпорт',
  },
  tradePartners: {
    title: 'Ключові країни-партнери (товари та IT-послуги)',
  },
  tradeCategories: {
    title: 'Структура торгівлі за категоріями (товари та послуги)',
    agriculture: 'Агро',
    minerals: 'Мінерали',
    chemicals: 'Хімія',
    timber: 'Деревина',
    manufactured: 'Промтовари',
    metals: 'Метали',
    machinery: 'Машини',
    unclassified_goods: 'Спецтовари та неформальна торгівля',
    it_services: 'IT та телеком',
    transport_services: 'Транспорт',
    travel: 'Подорожі',
    business_services: 'Ділові послуги',
    other: 'Інше',
  },
};
