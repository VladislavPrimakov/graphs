import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  payloadCapacity: {
    title: 'Orbitale Nutzlastkapazität (LEO/SSO)',
    kpis: {
      totalLaunches: 'Starts insgesamt',
      totalPayload: 'Gesamte beförderte Nutzlast',
      leaderShare: 'Spitzenreiter-Anteil aller Starts',
    },
  },
  launchCosts: {
    title: 'Startkosten in den Orbit nach Jahrzehnten (LEO/SSO, 2021 USD)',
    kpis: {
      bestAvgCost: 'Bester Durchschnittspreis',
      costReduction: 'Kostenreduzierung',
      lowestCost: 'Niedrigste Kosten',
    },
  },
  avgPayload: {
    title: 'Durchschnittliche Nutzlast pro Start nach Jahrzehnten (LEO/SSO)',
    kpis: {
      bestAvgPayload: 'Beste Durchschnittsnutzlast',
      payloadGrowth: 'Wachstum der Nutzlastkapazität',
      heavyClassRecord: 'Rekord der Schwerlastklasse',
    },
  },
  failureRates: {
    title: 'Fehlerrate orbitaler Starts nach Jahrzehnten',
    kpis: {
      globalSuccessRate: 'Globale Zuverlässigkeit aller Starts',
      reliabilityGrowth: 'Zuverlässigkeitszuwachs über Jahrzehnte',
      bestDecadeReliability: 'Höchste Zuverlässigkeit im Jahrzehnt (>50 Starts)',
    },
  },
};
