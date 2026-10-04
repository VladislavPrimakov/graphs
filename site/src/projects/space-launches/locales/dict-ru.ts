import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  payloadCapacity: {
    title: 'Полезная нагрузка на орбите (НОО/ССО)',
    kpis: {
      totalLaunches: 'Всего запусков',
      totalPayload: 'Всего на орбите',
      leaderShare: 'Доля лидера среди всех запусков',
    },
  },
  launchCosts: {
    title: 'Стоимость вывода на орбиту по десятилетиям (НОО/ССО, 2021 USD)',
    kpis: {
      bestAvgCost: 'Лучшая средняя цена',
      costReduction: 'Снижение стоимости',
      lowestCost: 'Минимальная цена',
    },
  },
  avgPayload: {
    title: 'Средняя масса за запуск по десятилетиям (НОО/ССО)',
    kpis: {
      bestAvgPayload: 'Лучшая средняя масса',
      payloadGrowth: 'Рост грузоподъемности',
      heavyClassRecord: 'Рекорд тяжёлого класса',
    },
  },
  failureRates: {
    title: 'Аварийность орбитальных пусков по десятилетиям',
    kpis: {
      globalSuccessRate: 'Глобальная надежность среди всех пусков',
      reliabilityGrowth: 'Рост надёжности среди декад',
      bestDecadeReliability: 'Рекорд надёжности за десятилетие (>50 пусков)',
    },
  },
};
