import path from 'node:path';
import type { AttackDataGroup } from '@graphs/types/war-rf-ua/attacks';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchWithRetry } from '@/utils/http';
import { getLogger } from '@/utils/logger';
import { round, sum } from '@/utils/math';
import { PIPELINES_SRC_DIR } from '@/utils/paths';

const DATA_RF_PATH = path.resolve(PIPELINES_SRC_DIR, 'war-rf-ua/data-attacks-rf.json');
const KAGGLE_DATASET = 'piterfm/massive-missile-attacks-on-ukraine';

/** Downloads a dataset file from Kaggle API following storage redirection directly in memory. */
async function fetchKaggleFile(fileName: string, token: string): Promise<string | null> {
  const logger = getLogger();
  try {
    const url = `https://www.kaggle.com/api/v1/datasets/download/${KAGGLE_DATASET}/${fileName}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    });

    let downloadUrl = url;
    if (res.status === 302 || res.status === 301) {
      downloadUrl = res.headers.get('location') || url;
    } else if (!res.ok) {
      logger.warn(`Failed to obtain download URL for Kaggle ${fileName} (HTTP ${res.status})`);
      return null;
    }

    const fileRes = await fetchWithRetry(downloadUrl, { retries: 3, timeoutMs: 45000 });
    if (!fileRes.ok) {
      logger.warn(`Failed to download ${fileName} from Kaggle storage (HTTP ${fileRes.status})`);
      return null;
    }

    const content = await fileRes.text();
    logger.debug(`Downloaded latest ${fileName} from Kaggle (${content.length.toLocaleString()} bytes)`);
    return content;
  } catch (err) {
    logger.warn(`Could not refresh ${fileName} from Kaggle: ${err}`);
    return null;
  }
}

interface AttackRow {
  time_start: string;
  model: string;
  launched: number;
  destroyed: number;
  category: string;
  date: string;
  month: string;
}

function parseLaunchedDetails(str: string): Record<string, number> | null {
  if (!str?.startsWith('{')) return null;
  const result: Record<string, number> = {};
  const regex = /['"]([^'"]+)['"]\s*:\s*(\d+)/g;
  for (const match of str.matchAll(regex)) {
    result[match[1]] = Number.parseInt(match[2], 10);
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Simple CSV parser that handles quoted cells with commas. */
function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

/** Parses raw Kaggle CSV content into structured AttackDataGroup. */
export function parseRfAttacksFromCsv(rawCsv: string, rawDict: string): AttackDataGroup {
  const dictRows = parseCsv(rawDict);
  const modelToCat = new Map<string, string>();

  for (const row of dictRows) {
    const model = row.model;
    const cat = (row.category || '').toLowerCase();
    const wType = (row.type || '').toLowerCase();

    let mapped = 'Other';
    if (cat.includes('uav')) {
      if (wType.includes('reconnaissance')) {
        mapped = 'Other';
      } else {
        mapped = 'UAVs';
      }
    } else if (cat.includes('ballistic') || cat.includes('surface-to-air')) {
      mapped = 'Ballistic';
    } else if (cat.includes('cruise')) {
      mapped = 'Cruise';
    }
    modelToCat.set(model, mapped);
  }

  const attackRows = parseCsv(rawCsv);
  const expandedRows: AttackRow[] = [];

  for (const row of attackRows) {
    const timeStart = row.time_start || '';
    if (!timeStart) continue;

    const dateStr = timeStart.slice(0, 10);
    const monthStr = timeStart.slice(0, 7);
    const destroyed = parseInt(row.destroyed || '0', 10) || 0;
    const details = parseLaunchedDetails(row.launched_details);

    if (details) {
      for (const [mName, count] of Object.entries(details)) {
        expandedRows.push({
          time_start: timeStart,
          model: mName,
          launched: count,
          destroyed: 0,
          category: modelToCat.get(mName) || 'Other',
          date: dateStr,
          month: monthStr,
        });
      }
    } else {
      const modelName = row.model || '';
      const launched = parseInt(row.launched || '0', 10) || 0;
      if (modelName.includes(' and ') && !modelToCat.has(modelName)) {
        continue;
      }
      expandedRows.push({
        time_start: timeStart,
        model: modelName,
        launched,
        destroyed,
        category: modelToCat.get(modelName) || 'Other',
        date: dateStr,
        month: monthStr,
      });
    }
  }

  const monthlyLaunched: Record<string, Record<string, number>> = {};
  for (const r of expandedRows) {
    if (!monthlyLaunched[r.month]) {
      monthlyLaunched[r.month] = { UAVs: 0, Ballistic: 0, Cruise: 0, Other: 0 };
    }
    monthlyLaunched[r.month][r.category] = (monthlyLaunched[r.month][r.category] || 0) + r.launched;
  }

  const periods = Object.keys(monthlyLaunched).sort();
  const formattedMonths = periods.map((p) => `${p.split('-')[1]}.${p.split('-')[0].slice(-2)}`);

  const monthlyUavs = periods.map((p) => monthlyLaunched[p].UAVs || 0);
  const monthlyBallistic = periods.map((p) => monthlyLaunched[p].Ballistic || 0);
  const monthlyCruise = periods.map((p) => monthlyLaunched[p].Cruise || 0);
  const monthlyMissiles = monthlyBallistic.map((b, i) => b + monthlyCruise[i]);

  const dailyLaunched: Record<string, Record<string, number>> = {};
  for (const r of expandedRows) {
    if (!dailyLaunched[r.date]) {
      dailyLaunched[r.date] = { UAVs: 0, Ballistic: 0, Cruise: 0, Other: 0 };
    }
    dailyLaunched[r.date][r.category] = (dailyLaunched[r.date][r.category] || 0) + r.launched;
  }

  const dailyDates = Object.keys(dailyLaunched).sort();
  const dailyLabels = dailyDates.map((d) => {
    const parts = d.split('-');
    return `${parts[2]}.${parts[1]}`;
  });

  const dailyUavs = dailyDates.map((d) => dailyLaunched[d].UAVs || 0);
  const dailyBallistic = dailyDates.map((d) => dailyLaunched[d].Ballistic || 0);
  const dailyCruise = dailyDates.map((d) => dailyLaunched[d].Cruise || 0);
  const dailyMissiles = dailyBallistic.map((b, i) => b + dailyCruise[i]);

  const totalUavs = sum(monthlyUavs);
  const totalBallistic = sum(monthlyBallistic);
  const totalCruise = sum(monthlyCruise);

  const numMonths = periods.length || 1;
  const maxUavIdx = monthlyUavs.length > 0 ? monthlyUavs.indexOf(Math.max(...monthlyUavs)) : 0;
  const uavPeakCount = Math.max(0, ...monthlyUavs);
  const uavPeakPeriod = formattedMonths[maxUavIdx] || '';
  const uavMonthlyAvg = round(totalUavs / numMonths, 0);

  const maxBalIdx = monthlyBallistic.length > 0 ? monthlyBallistic.indexOf(Math.max(...monthlyBallistic)) : 0;
  const balPeakCount = Math.max(0, ...monthlyBallistic);
  const balPeakPeriod = formattedMonths[maxBalIdx] || '';
  const balMonthlyAvg = round(totalBallistic / numMonths, 0);

  const maxCruiseIdx = monthlyCruise.length > 0 ? monthlyCruise.indexOf(Math.max(...monthlyCruise)) : 0;
  const cruisePeakCount = Math.max(0, ...monthlyCruise);
  const cruisePeakPeriod = formattedMonths[maxCruiseIdx] || '';
  const cruiseMonthlyAvg = round(totalCruise / numMonths, 0);

  const numDays = dailyDates.length || 1;
  const maxUavDayIdx = dailyUavs.length > 0 ? dailyUavs.indexOf(Math.max(...dailyUavs)) : 0;
  const uavDailyPeakCount = Math.max(0, ...dailyUavs);
  const uavDailyPeakDate = dailyDates[maxUavDayIdx] ? `${dailyDates[maxUavDayIdx].split('-')[2]}.${dailyDates[maxUavDayIdx].split('-')[1]}.${dailyDates[maxUavDayIdx].slice(2, 4)}` : '';
  const uavDailyAvg = round(totalUavs / numDays, 0);

  const maxBalDayIdx = dailyBallistic.length > 0 ? dailyBallistic.indexOf(Math.max(...dailyBallistic)) : 0;
  const balDailyPeakCount = Math.max(0, ...dailyBallistic);
  const balDailyPeakDate = dailyDates[maxBalDayIdx] ? `${dailyDates[maxBalDayIdx].split('-')[2]}.${dailyDates[maxBalDayIdx].split('-')[1]}.${dailyDates[maxBalDayIdx].slice(2, 4)}` : '';
  const balDailyAvg = round(totalBallistic / numDays, 0);

  const maxCruiseDayIdx = dailyCruise.length > 0 ? dailyCruise.indexOf(Math.max(...dailyCruise)) : 0;
  const cruiseDailyPeakCount = Math.max(0, ...dailyCruise);
  const cruiseDailyPeakDate = dailyDates[maxCruiseDayIdx] ? `${dailyDates[maxCruiseDayIdx].split('-')[2]}.${dailyDates[maxCruiseDayIdx].split('-')[1]}.${dailyDates[maxCruiseDayIdx].slice(2, 4)}` : '';
  const cruiseDailyAvg = round(totalCruise / numDays, 0);

  return {
    summary: {
      uavs: {
        total: totalUavs,
        monthlyAvg: uavMonthlyAvg,
        peakCount: uavPeakCount,
        peakPeriod: uavPeakPeriod,
        dailyAvg: uavDailyAvg,
        dailyPeakCount: uavDailyPeakCount,
        dailyPeakDate: uavDailyPeakDate,
      },
      ballistic: {
        total: totalBallistic,
        monthlyAvg: balMonthlyAvg,
        peakCount: balPeakCount,
        peakPeriod: balPeakPeriod,
        dailyAvg: balDailyAvg,
        dailyPeakCount: balDailyPeakCount,
        dailyPeakDate: balDailyPeakDate,
      },
      cruise: {
        total: totalCruise,
        monthlyAvg: cruiseMonthlyAvg,
        peakCount: cruisePeakCount,
        peakPeriod: cruisePeakPeriod,
        dailyAvg: cruiseDailyAvg,
        dailyPeakCount: cruiseDailyPeakCount,
        dailyPeakDate: cruiseDailyPeakDate,
      },
    },
    daily: {
      dates: dailyDates,
      labels: dailyLabels,
      uavs: dailyUavs,
      ballistic: dailyBallistic,
      cruise: dailyCruise,
      totalMissiles: dailyMissiles,
    },
    monthly: {
      periods,
      labels: formattedMonths,
      uavs: monthlyUavs,
      ballistic: monthlyBallistic,
      cruise: monthlyCruise,
      totalMissiles: monthlyMissiles,
    },
  };
}

/** Runs the RF air attacks parser using local data-rf.json snapshot or syncs with Kaggle API if requested. */
export async function parseRfAttacks(forceUpdate = false): Promise<AttackDataGroup> {
  const logger = getLogger();
  const hasSnapshot = await fileExists(DATA_RF_PATH);

  if (!forceUpdate && hasSnapshot) {
    try {
      const snapshot = await readJson<AttackDataGroup>(DATA_RF_PATH);
      logger.debug(`Loaded RF attacks snapshot from ${path.basename(DATA_RF_PATH)}`);
      return snapshot;
    } catch (e) {
      logger.warn(`Failed reading ${DATA_RF_PATH}: ${e}`);
    }
  }

  const token = process.env.KAGGLE_API_TOKEN;
  if (!token) {
    if (hasSnapshot) {
      logger.debug('KAGGLE_API_TOKEN not found. Reusing committed data-rf.json snapshot.');
      return await readJson<AttackDataGroup>(DATA_RF_PATH);
    }
    throw new Error('KAGGLE_API_TOKEN not found and data-rf.json snapshot is missing.');
  }

  logger.debug('Syncing latest RF attacks data from Kaggle API...');
  const [rawCsv, rawDict] = await Promise.all([fetchKaggleFile('missile_attacks_daily.csv', token), fetchKaggleFile('missiles_and_uavs.csv', token)]);

  if (!rawCsv || !rawDict) {
    if (hasSnapshot) {
      logger.warn('Failed to download Kaggle files. Reusing existing data-rf.json snapshot.');
      return await readJson<AttackDataGroup>(DATA_RF_PATH);
    }
    throw new Error('Failed to download Kaggle datasets and data-rf.json snapshot is missing.');
  }

  const attackGroup = parseRfAttacksFromCsv(rawCsv, rawDict);
  await writeJson(DATA_RF_PATH, attackGroup, 0);
  logger.debug(`Updated ${path.basename(DATA_RF_PATH)} with latest Kaggle attacks data`);
  return attackGroup;
}
