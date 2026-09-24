import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttackDataGroup } from '@/types';
import { fileExists } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger } from '../utils/logger.js';

try {
  process.loadEnvFile?.();
} catch {
  // ignore if .env missing
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, 'cache');
const CSV_PATH = path.join(CACHE_DIR, 'missile_attacks_daily.csv');
const DICT_PATH = path.join(CACHE_DIR, 'missiles_and_uavs.csv');
const KAGGLE_DATASET = 'piterfm/massive-missile-attacks-on-ukraine';

/** Downloads a dataset file from Kaggle API following storage redirection. */
async function downloadKaggleFile(fileName: string, targetPath: string, token: string): Promise<boolean> {
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
      return false;
    }

    const fileRes = await fetchWithRetry(downloadUrl, { retries: 3, timeoutMs: 45000 });
    if (!fileRes.ok) {
      logger.warn(`Failed to download ${fileName} from Kaggle storage (HTTP ${fileRes.status})`);
      return false;
    }

    const content = await fileRes.text();
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
    logger.debug(`Downloaded latest ${fileName} from Kaggle (${content.length.toLocaleString()} bytes)`);
    return true;
  } catch (err) {
    logger.warn(`Could not refresh ${fileName} from Kaggle: ${err}`);
    return false;
  }
}

/** Synchronizes Kaggle dataset files if API token is present. */
async function syncKaggleDatasets(force = false): Promise<void> {
  const logger = getLogger();
  const token = process.env.KAGGLE_API_TOKEN;
  const hasCsv = await fileExists(CSV_PATH);
  const hasDict = await fileExists(DICT_PATH);

  if (!token) {
    if (!hasCsv || !hasDict) {
      logger.warn('KAGGLE_API_TOKEN not found and local CSV cache is missing.');
    }
    return;
  }

  if (force || !hasCsv || !hasDict) {
    logger.debug('Syncing latest RF attacks data from Kaggle API...');
    await Promise.all([downloadKaggleFile('missile_attacks_daily.csv', CSV_PATH, token), downloadKaggleFile('missiles_and_uavs.csv', DICT_PATH, token)]);
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

/** Runs the RF air attacks parser on the Kaggle daily attacks dataset. */
export async function parseRfAttacks(forceUpdate = false): Promise<AttackDataGroup> {
  const logger = getLogger();
  await syncKaggleDatasets(forceUpdate);
  logger.debug(`Loading RF attacks dataset: ${path.basename(CSV_PATH)}`);
  const rawCsv = await fs.readFile(CSV_PATH, 'utf-8');
  const rawDict = await fs.readFile(DICT_PATH, 'utf-8');

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

  // Monthly Aggregation
  const monthlyLaunched: Record<string, Record<string, number>> = {};
  const monthlyTotalLaunched: Record<string, number> = {};
  const monthlyTotalDestroyed: Record<string, number> = {};

  for (const r of expandedRows) {
    if (!monthlyLaunched[r.month]) {
      monthlyLaunched[r.month] = { UAVs: 0, Ballistic: 0, Cruise: 0, Other: 0 };
    }
    monthlyLaunched[r.month][r.category] = (monthlyLaunched[r.month][r.category] || 0) + r.launched;
    monthlyTotalLaunched[r.month] = (monthlyTotalLaunched[r.month] || 0) + r.launched;
    monthlyTotalDestroyed[r.month] = (monthlyTotalDestroyed[r.month] || 0) + r.destroyed;
  }

  const periods = Object.keys(monthlyLaunched).sort();
  const formattedMonths = periods.map((p) => `${p.split('-')[1]}.${p.split('-')[0].slice(-2)}`);

  const monthlyUavs = periods.map((p) => monthlyLaunched[p].UAVs || 0);
  const monthlyBallistic = periods.map((p) => monthlyLaunched[p].Ballistic || 0);
  const monthlyCruise = periods.map((p) => monthlyLaunched[p].Cruise || 0);
  const monthlyMissiles = monthlyBallistic.map((b, i) => b + monthlyCruise[i]);
  const monthlyTotalsLaunched = periods.map((p) => monthlyTotalLaunched[p] || 0);
  const monthlyTotalsDestroyed = periods.map((p) => monthlyTotalDestroyed[p] || 0);

  // Daily Aggregation
  const dailyLaunched: Record<string, Record<string, number>> = {};
  const dailyTotalLaunched: Record<string, number> = {};
  const dailyTotalDestroyed: Record<string, number> = {};

  for (const r of expandedRows) {
    if (!dailyLaunched[r.date]) {
      dailyLaunched[r.date] = { UAVs: 0, Ballistic: 0, Cruise: 0, Other: 0 };
    }
    dailyLaunched[r.date][r.category] = (dailyLaunched[r.date][r.category] || 0) + r.launched;
    dailyTotalLaunched[r.date] = (dailyTotalLaunched[r.date] || 0) + r.launched;
    dailyTotalDestroyed[r.date] = (dailyTotalDestroyed[r.date] || 0) + r.destroyed;
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
  const dailyTotalsLaunched = dailyDates.map((d) => dailyTotalLaunched[d] || 0);
  const dailyTotalsDestroyed = dailyDates.map((d) => dailyTotalDestroyed[d] || 0);

  const totalUavs = monthlyUavs.reduce((a, b) => a + b, 0);
  const totalBallistic = monthlyBallistic.reduce((a, b) => a + b, 0);
  const totalCruise = monthlyCruise.reduce((a, b) => a + b, 0);
  const totalMissilesLaunched = totalBallistic + totalCruise;
  const totalAllLaunched = monthlyTotalsLaunched.reduce((a, b) => a + b, 0);
  const totalAllDestroyed = monthlyTotalsDestroyed.reduce((a, b) => a + b, 0);

  const numMonths = periods.length || 1;
  const maxUavIdx = monthlyUavs.length > 0 ? monthlyUavs.indexOf(Math.max(...monthlyUavs)) : 0;
  const uavPeakCount = Math.max(0, ...monthlyUavs);
  const uavPeakPeriod = formattedMonths[maxUavIdx] || '';
  const uavMonthlyAvg = Math.round(totalUavs / numMonths);
  const uavSharePct = totalAllLaunched > 0 ? Math.round((totalUavs / totalAllLaunched) * 1000) / 10 : 0;

  const maxBalIdx = monthlyBallistic.length > 0 ? monthlyBallistic.indexOf(Math.max(...monthlyBallistic)) : 0;
  const balPeakCount = Math.max(0, ...monthlyBallistic);
  const balPeakPeriod = formattedMonths[maxBalIdx] || '';
  const balMonthlyAvg = Math.round(totalBallistic / numMonths);
  const balSharePct = totalMissilesLaunched > 0 ? Math.round((totalBallistic / totalMissilesLaunched) * 1000) / 10 : 0;

  const maxCruiseIdx = monthlyCruise.length > 0 ? monthlyCruise.indexOf(Math.max(...monthlyCruise)) : 0;
  const cruisePeakCount = Math.max(0, ...monthlyCruise);
  const cruisePeakPeriod = formattedMonths[maxCruiseIdx] || '';
  const cruiseMonthlyAvg = Math.round(totalCruise / numMonths);
  const cruiseSharePct = totalMissilesLaunched > 0 ? Math.round((totalCruise / totalMissilesLaunched) * 1000) / 10 : 0;

  const numDays = dailyDates.length || 1;
  const maxUavDayIdx = dailyUavs.length > 0 ? dailyUavs.indexOf(Math.max(...dailyUavs)) : 0;
  const uavDailyPeakCount = Math.max(0, ...dailyUavs);
  const uavDailyPeakDate = dailyDates[maxUavDayIdx] ? `${dailyDates[maxUavDayIdx].split('-')[2]}.${dailyDates[maxUavDayIdx].split('-')[1]}.${dailyDates[maxUavDayIdx].slice(2, 4)}` : '';
  const uavDailyAvg = Math.round(totalUavs / numDays);

  const maxBalDayIdx = dailyBallistic.length > 0 ? dailyBallistic.indexOf(Math.max(...dailyBallistic)) : 0;
  const balDailyPeakCount = Math.max(0, ...dailyBallistic);
  const balDailyPeakDate = dailyDates[maxBalDayIdx] ? `${dailyDates[maxBalDayIdx].split('-')[2]}.${dailyDates[maxBalDayIdx].split('-')[1]}.${dailyDates[maxBalDayIdx].slice(2, 4)}` : '';
  const balDailyAvg = Math.round(totalBallistic / numDays);

  const maxCruiseDayIdx = dailyCruise.length > 0 ? dailyCruise.indexOf(Math.max(...dailyCruise)) : 0;
  const cruiseDailyPeakCount = Math.max(0, ...dailyCruise);
  const cruiseDailyPeakDate = dailyDates[maxCruiseDayIdx] ? `${dailyDates[maxCruiseDayIdx].split('-')[2]}.${dailyDates[maxCruiseDayIdx].split('-')[1]}.${dailyDates[maxCruiseDayIdx].slice(2, 4)}` : '';
  const cruiseDailyAvg = Math.round(totalCruise / numDays);

  return {
    summary: {
      total_launched: totalAllLaunched,
      total_destroyed: totalAllDestroyed,
      total_uavs: totalUavs,
      total_ballistic: totalBallistic,
      total_cruise: totalCruise,
      total_missiles: totalMissilesLaunched,
      intercept_rate_pct: totalAllLaunched > 0 ? Math.round((totalAllDestroyed / totalAllLaunched) * 1000) / 10 : 0,
      uavs: {
        total: totalUavs,
        monthly_avg: uavMonthlyAvg,
        peak_count: uavPeakCount,
        peak_period: uavPeakPeriod,
        daily_avg: uavDailyAvg,
        daily_peak_count: uavDailyPeakCount,
        daily_peak_date: uavDailyPeakDate,
        share_pct: uavSharePct,
      },
      ballistic: {
        total: totalBallistic,
        monthly_avg: balMonthlyAvg,
        peak_count: balPeakCount,
        peak_period: balPeakPeriod,
        daily_avg: balDailyAvg,
        daily_peak_count: balDailyPeakCount,
        daily_peak_date: balDailyPeakDate,
        share_pct: balSharePct,
      },
      cruise: {
        total: totalCruise,
        monthly_avg: cruiseMonthlyAvg,
        peak_count: cruisePeakCount,
        peak_period: cruisePeakPeriod,
        daily_avg: cruiseDailyAvg,
        daily_peak_count: cruiseDailyPeakCount,
        daily_peak_date: cruiseDailyPeakDate,
        share_pct: cruiseSharePct,
      },
    },
    daily: {
      dates: dailyDates,
      labels: dailyLabels,
      uavs: dailyUavs,
      ballistic: dailyBallistic,
      cruise: dailyCruise,
      total_missiles: dailyMissiles,
      total_launched: dailyTotalsLaunched,
      total_destroyed: dailyTotalsDestroyed,
    },
    monthly: {
      periods,
      labels: formattedMonths,
      uavs: monthlyUavs,
      ballistic: monthlyBallistic,
      cruise: monthlyCruise,
      total_missiles: monthlyMissiles,
      total_launched: monthlyTotalsLaunched,
      total_destroyed: monthlyTotalsDestroyed,
    },
  };
}
