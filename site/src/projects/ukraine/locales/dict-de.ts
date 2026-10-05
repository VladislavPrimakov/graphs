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
    nominalGdp: 'Nominales BIP',
    fxRate: 'USD-Wechselkurs',
    gdp: 'BIP',
  },
  tradeStructure: {
    title: 'Struktur des Warenhandels (Warenumsatz)',
    exports: 'Exporte (FOB)',
    imports: 'Importe (CIF)',
  },
  tradePartners: {
    title: 'Wichtigste Handelspartner nach Warenumsatz',
  },
  tradeCategories: {
    title: 'Warenhandelsstruktur nach Gütergruppen',
    agriculture: 'Agrar',
    minerals: 'Mineralien',
    chemicals: 'Chemie',
    timber: 'Holz',
    manufactured: 'Industriewaren',
    metals: 'Metalle',
    machinery: 'Maschinen',
    other: 'Sonstiges',
  },
};
