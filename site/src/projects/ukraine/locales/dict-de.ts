import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  budgetAndDebt: {
    title: 'Staatlicher Haushaltsvollzug & Dynamik der Auslandsverschuldung',
    domesticRevenues: 'Inlandseinnahmen',
    defenseSpending: 'Verteidigungsausgaben',
    nonDefenseSpending: 'Zivilausgaben',
    grants: 'Internationale Zuschüsse',
    loans: 'Internationale Kredite (Nettokreditaufnahme)',
    externalDebt: 'Bruttoauslandsverschuldung',
    govDebt: 'Staatliche Auslandsschulden',
    privateDebt: 'Private Auslandsschulden',
    nominalGdp: 'Nominales BIP',
    fxRate: 'USD-Wechselkurs',
    gdp: 'BIP',
  },
  tradeStructure: {
    title: 'Außenhandelsstruktur (Waren & Dienstleistungen)',
    exports: 'Exporte',
    imports: 'Importe',
  },
  tradePartners: {
    title: 'Wichtigste Handelspartner (Waren & IT-Dienste)',
  },
  tradeCategories: {
    title: 'Handelsstruktur nach Kategorien (Waren & Dienstleistungen)',
    agriculture: 'Agrar',
    minerals: 'Mineralien',
    chemicals: 'Chemie',
    timber: 'Holz',
    manufactured: 'Industriewaren',
    metals: 'Metalle',
    machinery: 'Maschinen',
    unclassified_goods: 'Sonderwaren & Informeller Handel',
    it_services: 'IT & Telekom',
    transport_services: 'Transport',
    travel: 'Reisen',
    business_services: 'Unternehmensdienste',
    other: 'Sonstiges',
  },
};
