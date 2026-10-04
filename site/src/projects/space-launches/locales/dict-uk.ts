import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  payloadCapacity: {
    title: 'Корисне навантаження на орбіті (НОО/ССО)',
    kpis: {
      totalLaunches: 'Всього запусків',
      totalPayload: 'Всього на орбіті',
      leaderShare: 'Частка лідера серед усіх запусків',
    },
  },
  launchCosts: {
    title: 'Вартість виведення на орбіту за десятиліттями (НОО/ССО, 2021 USD)',
    kpis: {
      bestAvgCost: 'Найкраща середня ціна',
      costReduction: 'Зниження вартості',
      lowestCost: 'Мінімальна ціна',
    },
  },
  avgPayload: {
    title: 'Середня маса за запуск за десятиліттями (НОО/ССО)',
    kpis: {
      bestAvgPayload: 'Найкраща середня маса',
      payloadGrowth: 'Зростання вантажопідйомності',
      heavyClassRecord: 'Рекорд важкого класу',
    },
  },
  failureRates: {
    title: 'Аварійність орбітальних запусків за десятиліттями',
    kpis: {
      globalSuccessRate: 'Глобальна надійність серед усіх запусків',
      reliabilityGrowth: 'Зростання надійності за десятиліттями',
      bestDecadeReliability: 'Рекорд надійності за десятиліття (>50 запусків)',
    },
  },
};
