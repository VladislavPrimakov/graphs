import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Raumfahrtstarts',
  description:
    'Historische Analyse orbitaler Raumflüge über sieben Jahrzehnte: jährliche Nutzlastmasse im Orbit nach Nationen, Startökonomie ($/kg in LEO/SSO), durchschnittliche Nutzlast pro Start und Zuverlässigkeitstrends.',
  sections: {
    'payload-capacity': 'Nutzlastkapazität',
    'launch-costs': 'Kosten pro kg',
    'avg-payload': 'Durchschnittliche Nutzlast',
    'failure-rates': 'Fehlerraten',
  },
};
