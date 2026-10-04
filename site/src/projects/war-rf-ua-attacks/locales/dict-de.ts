import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  uavDynamics: {
    titleDaily: 'Tägliche Starts und Abfänge von Kampfdrohnen',
    titleMonthly: 'Monatliche Starts und Abfänge von Kampfdrohnen',
    strikes: 'Angriffe',
    kpis: {
      totalStrikeUavs: 'Kampfdrohnen insgesamt',
      dailyAverage: 'Tagesdurchschnitt',
      monthlyAverage: 'Monatsdurchschnitt',
      dailyPeak: 'Tageshöchstwert',
      monthlyPeak: 'Monatshöchstwert',
      uavIntercepts: 'Abgefangene Drohnen',
    },
  },
  missileDynamics: {
    titleDaily: 'Tägliche Raketenangriffe und Abfänge',
    titleMonthly: 'Monatliche Raketenangriffe: Ballistische Raketen vs. Marschflugkörper',
    strikes: 'Angriffe',
    ballistic: 'Ballistisch',
    cruise: 'Marschflugkörper',
    kpis: {
      ballisticTotal: 'Ballistische Raketen gesamt',
      cruiseTotal: 'Marschflugkörper gesamt',
      ballisticIntercepts: 'Abgefangene ballistische Raketen',
      cruiseIntercepts: 'Abgefangene Marschflugkörper',
      ballisticDailyAvg: 'Ballistisch (Tagesdurchschnitt)',
      ballisticMonthlyAvg: 'Ballistisch (Monatsdurchschnitt)',
      cruiseDailyAvg: 'Marschflugkörper (Tagesdurchschnitt)',
      cruiseMonthlyAvg: 'Marschflugkörper (Monatsdurchschnitt)',
      ballisticPeak: 'Spitze ballistisch',
      cruisePeak: 'Spitze Marschflugkörper',
    },
  },
};
