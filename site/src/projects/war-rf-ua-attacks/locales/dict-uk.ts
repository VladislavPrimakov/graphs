import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  uavDynamics: {
    titleDaily: 'Добові пуски та перехоплення ударних БПЛА',
    titleMonthly: 'Помісячні пуски та перехоплення ударних БПЛА',
    strikes: 'Удари',
    kpis: {
      totalStrikeUavs: 'Всього ударних БПЛА',
      dailyAverage: 'Середньодобово',
      monthlyAverage: 'В середньому за місяць',
      dailyPeak: 'Добовий пік',
      monthlyPeak: 'Місячний пік',
      uavIntercepts: 'Перехоплено БПЛА',
    },
  },
  missileDynamics: {
    titleDaily: 'Добові ракетні удари та перехоплення',
    titleMonthly: 'Помісячні ракетні удари: балістика та крилаті ракети',
    strikes: 'Удари',
    ballistic: 'Баллістика',
    cruise: 'Крилаті ракети',
    kpis: {
      ballisticTotal: 'Всього балістики',
      cruiseTotal: 'Всього крилатих',
      ballisticIntercepts: 'Перехоплено балістики',
      cruiseIntercepts: 'Перехоплено крилатих',
      ballisticDailyAvg: 'Балістика (сер/доб)',
      ballisticMonthlyAvg: 'Балістика (сер/міс)',
      cruiseDailyAvg: 'Крилаті (сер/доб)',
      cruiseMonthlyAvg: 'Крилаті (сер/міс)',
      ballisticPeak: 'Пік балістики',
      cruisePeak: 'Пік крилатих',
    },
  },
};
