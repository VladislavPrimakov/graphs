import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  uavDynamics: {
    titleDaily: 'Суточные пуски и перехваты ударных БПЛА',
    titleMonthly: 'Помесячные пуски и перехваты ударных БПЛА',
    strikes: 'Удары',
    kpis: {
      totalStrikeUavs: 'Всего ударных БПЛА',
      dailyAverage: 'Среднесуточно',
      monthlyAverage: 'В среднем за месяц',
      dailyPeak: 'Суточный пик',
      monthlyPeak: 'Месячный пик',
      uavIntercepts: 'Перехвачено БПЛА',
    },
  },
  missileDynamics: {
    titleDaily: 'Суточные ракетные удары и перехваты',
    titleMonthly: 'Помесячные ракетные удары: баллистика и крылатые ракеты',
    strikes: 'Удары',
    ballistic: 'Баллистика',
    cruise: 'Крылатые ракеты',
    kpis: {
      ballisticTotal: 'Всего баллистики',
      cruiseTotal: 'Всего крылатых',
      ballisticIntercepts: 'Перехвачено баллистики',
      cruiseIntercepts: 'Перехвачено крылатых',
      ballisticDailyAvg: 'Баллистика (ср/сут)',
      ballisticMonthlyAvg: 'Баллистика (ср/мес)',
      cruiseDailyAvg: 'Крылатые (ср/сут)',
      cruiseMonthlyAvg: 'Крылатые (ср/мес)',
      ballisticPeak: 'Пик баллистики',
      cruisePeak: 'Пик крылатых',
    },
  },
};
