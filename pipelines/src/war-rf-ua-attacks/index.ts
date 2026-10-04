import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WarAttacksDataset } from '@graphs/types';
import { writeJson } from '../utils/fs';
import { getLogger, runWithLogger } from '../utils/logger';
import { updateMetadata } from '../utils/metadata';
import { parseRfAttacks } from './parse-rf';
import { parseUaAttacks } from './parse-ua';

try {
  process.loadEnvFile?.();
} catch {
  // ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AttackDataSubRecord {
  uavs: number;
  ballistic: number;
  cruise: number;
  missiles: number;
}

/** Builds unified monthly time series aligning RF and UA data points. */
function buildUnifiedMonthly(
  rfMonthly: { periods: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
  uaMonthly: { periods: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
) {
  const rfDict: Record<string, AttackDataSubRecord> = {};
  rfMonthly.periods.forEach((p, idx) => {
    rfDict[p] = {
      uavs: rfMonthly.uavs[idx] || 0,
      ballistic: rfMonthly.ballistic[idx] || 0,
      cruise: rfMonthly.cruise[idx] || 0,
      missiles: rfMonthly.totalMissiles[idx] || 0,
    };
  });

  const uaDict: Record<string, AttackDataSubRecord> = {};
  uaMonthly.periods.forEach((p, idx) => {
    uaDict[p] = {
      uavs: uaMonthly.uavs[idx] || 0,
      ballistic: uaMonthly.ballistic[idx] || 0,
      cruise: uaMonthly.cruise[idx] || 0,
      missiles: uaMonthly.totalMissiles[idx] || 0,
    };
  });

  const allPeriods = Array.from(new Set([...Object.keys(rfDict), ...Object.keys(uaDict)])).sort();
  const labels = allPeriods.map((p) => `${p.split('-')[1]}.${p.split('-')[0].slice(-2)}`);

  return {
    periods: allPeriods,
    labels,
    rfUavs: allPeriods.map((p) => rfDict[p]?.uavs || 0),
    rfBallistic: allPeriods.map((p) => rfDict[p]?.ballistic || 0),
    rfCruise: allPeriods.map((p) => rfDict[p]?.cruise || 0),
    uaUavs: allPeriods.map((p) => uaDict[p]?.uavs || 0),
    uaBallistic: allPeriods.map((p) => uaDict[p]?.ballistic || 0),
    uaCruise: allPeriods.map((p) => uaDict[p]?.cruise || 0),
  };
}

/** Builds unified daily time series aligning RF and UA data points. */
function buildUnifiedDaily(
  rfDaily: { dates: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
  uaDaily: { dates: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
) {
  const rfDict: Record<string, AttackDataSubRecord> = {};
  rfDaily.dates.forEach((d, idx) => {
    rfDict[d] = {
      uavs: rfDaily.uavs[idx] || 0,
      ballistic: rfDaily.ballistic[idx] || 0,
      cruise: rfDaily.cruise[idx] || 0,
      missiles: rfDaily.totalMissiles[idx] || 0,
    };
  });

  const uaDict: Record<string, AttackDataSubRecord> = {};
  uaDaily.dates.forEach((d, idx) => {
    uaDict[d] = {
      uavs: uaDaily.uavs[idx] || 0,
      ballistic: uaDaily.ballistic[idx] || 0,
      cruise: uaDaily.cruise[idx] || 0,
      missiles: uaDaily.totalMissiles[idx] || 0,
    };
  });

  const allDates = Array.from(new Set([...Object.keys(rfDict), ...Object.keys(uaDict)])).sort();
  const labels = allDates.map((d) => `${d.split('-')[2]}.${d.split('-')[1]}`);

  return {
    dates: allDates,
    labels,
    rfUavs: allDates.map((d) => rfDict[d]?.uavs || 0),
    rfBallistic: allDates.map((d) => rfDict[d]?.ballistic || 0),
    rfCruise: allDates.map((d) => rfDict[d]?.cruise || 0),
    uaUavs: allDates.map((d) => uaDict[d]?.uavs || 0),
    uaBallistic: allDates.map((d) => uaDict[d]?.ballistic || 0),
    uaCruise: allDates.map((d) => uaDict[d]?.cruise || 0),
  };
}

/** Runs the aggregated air attacks pipeline. */
export async function runWarAttacksPipeline(options: { updateTg?: boolean; updateRf?: boolean; threads?: number; outputFile?: string; verbose?: boolean } = {}) {
  const { updateTg = false, updateRf = false, threads = 16, outputFile, verbose } = options;
  return runWithLogger(
    'war-rf-ua-attacks',
    async () => {
      const logger = getLogger();
      logger.start('Starting War Air Attacks ETL pipeline');

      logger.debug('Processing RF attacks on Ukraine (Kaggle dataset)...');
      const rfData = await parseRfAttacks(updateRf);

      logger.debug('Processing UA attacks on Russia / RU areas (Telegram MoD)...');
      const uaData = await parseUaAttacks(undefined, updateTg, threads);

      const unifiedMonthly = buildUnifiedMonthly(rfData.monthly!, uaData.monthly!);
      const unifiedDaily = buildUnifiedDaily(rfData.daily!, uaData.daily!);

      const combinedData: WarAttacksDataset = {
        rfAttacks: { summary: rfData.summary },
        uaAttacks: { summary: uaData.summary },
        unifiedTimeline: {
          monthly: unifiedMonthly,
          daily: unifiedDaily,
        },
      };

      const targetOutput = outputFile || path.resolve(__dirname, '../../../site/src/data/war-rf-ua-attacks.json');
      await writeJson(targetOutput, combinedData);
      await updateMetadata('war-rf-ua-attacks');

      const totalRf = rfData.summary.uavs.total + rfData.summary.ballistic.total + rfData.summary.cruise.total;
      const totalUa = uaData.summary.uavs.total + uaData.summary.ballistic.total + uaData.summary.cruise.total;
      logger.success(`Exported war-rf-ua-attacks dataset (RF: ${totalRf.toLocaleString()} launched, UA: ${totalUa.toLocaleString()} intercepted)`);
      return combinedData;
    },
    verbose,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const isUpdate = process.argv.includes('-u') || process.argv.includes('--update');
  runWarAttacksPipeline({ updateTg: isUpdate, updateRf: isUpdate }).catch((err) => {
    getLogger('war-rf-ua-attacks').error('Fatal error running war-rf-ua-attacks pipeline:', err);
    process.exit(1);
  });
}
