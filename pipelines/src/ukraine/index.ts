import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX, { type WorkSheet } from 'xlsx';

import type { TradePartnerTuple, UkraineDataset } from '@/types';
import { ensureDir, fileExists, readJson, writeJson } from '../utils/fs.js';
import { fetchWithRetry } from '../utils/http.js';
import { getLogger, runWithLogger } from '../utils/logger.js';
import { updateMetadata } from '../utils/metadata.js';
import { resolveRegionCode } from '../utils/region.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const START_YEAR = 2022;
const SCRIPT_DIR = __dirname;
const CACHE_DIR = path.resolve(SCRIPT_DIR, 'cache');
const BUDGET_FILE = path.join(CACHE_DIR, 'C_budget_m.xlsx');
const TRADE_FILE = path.join(CACHE_DIR, 'Trade_y.xlsx');
const DEBT_FILE = path.join(CACHE_DIR, 'ZB_q_UAH.xlsx');
const GDP_FILE = path.join(CACHE_DIR, 'GDP_y.xlsx');
const RATES_CACHE_FILE = path.join(CACHE_DIR, 'usd_rates.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../../site/src/data/ukraine.json');

const URL_BUDGET = 'https://bank.gov.ua/files/macro/C_budget_m.xlsx';
const URL_TRADE = 'https://bank.gov.ua/files/ES/Trade_y.xlsx';
const URL_DEBT = 'https://bank.gov.ua/files/ES/ZB_q_UAH.xlsx';
const URL_GDP = 'https://bank.gov.ua/files/macro/GDP_y.xlsx';

/** Downloads a binary file from NBU to disk if missing or during forced update. */
async function downloadFile(url: string, filePath: string): Promise<void> {
  const logger = getLogger();
  await ensureDir(filePath);
  try {
    const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 30000 });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      logger.debug(`Downloaded latest ${path.basename(filePath)}`);
    }
  } catch (err) {
    logger.warn(`Warning downloading ${url}: ${err}`);
    if (await fileExists(filePath)) {
      logger.debug(`Using existing cached file ${filePath}`);
    } else {
      throw err;
    }
  }
}

/** Ensures all required NBU Excel files exist in cache. */
async function ensureDataFiles(forceUpdate = false): Promise<void> {
  const files: [string, string][] = [
    [URL_BUDGET, BUDGET_FILE],
    [URL_TRADE, TRADE_FILE],
    [URL_DEBT, DEBT_FILE],
    [URL_GDP, GDP_FILE],
  ];
  for (const [url, filePath] of files) {
    if (forceUpdate || !(await fileExists(filePath))) {
      await downloadFile(url, filePath);
    }
  }
}

/** Fetches monthly average USD/UAH exchange rates from NBU API. */
async function getMonthlyExchangeRates(yearsMonths: Record<number, number[]>, forceUpdate = false): Promise<Record<string, number>> {
  const logger = getLogger();
  let cache: Record<string, Record<string, number>> = {};
  if (await fileExists(RATES_CACHE_FILE)) {
    try {
      cache = await readJson<Record<string, Record<string, number>>>(RATES_CACHE_FILE);
    } catch (err) {
      logger.warn('Could not read exchange rates cache:', err);
    }
  }

  const currentYear = new Date().getFullYear();
  let cacheModified = false;
  const ratesByMonth: Record<string, number> = {};

  for (const year of Object.keys(yearsMonths)
    .map(Number)
    .sort((a, b) => a - b)) {
    const yearStr = String(year);
    const requiredMonths = yearsMonths[year];
    const hasAllMonths = yearStr in cache && requiredMonths.every((m) => String(m) in cache[yearStr]);

    if (!forceUpdate && year < currentYear && hasAllMonths) {
      for (const m of requiredMonths) {
        ratesByMonth[`${year}-${m}`] = cache[yearStr][String(m)];
      }
    } else {
      logger.debug(`Fetching USD/UAH rates for ${year} from NBU API...`);
      try {
        const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${year}0101&end=${year}1231&valcode=usd&sort=exchangedate&order=asc&json`;
        const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 20000 });
        if (res.ok) {
          const data = (await res.json()) as Array<{ exchangedate?: string; rate?: number }>;
          const monthVals: Record<number, number[]> = {};
          for (const item of data) {
            if (item.exchangedate && item.rate != null) {
              const parts = item.exchangedate.split('.');
              if (parts.length === 3) {
                const m = parseInt(parts[1], 10);
                if (!monthVals[m]) monthVals[m] = [];
                monthVals[m].push(item.rate);
              }
            }
          }

          const yearRates = cache[yearStr] || {};
          for (const [m, vals] of Object.entries(monthVals)) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            ratesByMonth[`${year}-${m}`] = avg;
            yearRates[m] = avg;
            cacheModified = true;
          }
          cache[yearStr] = yearRates;
        }
      } catch (err) {
        logger.warn(`Could not fetch rates for ${year}: ${err}`);
        if (yearStr in cache) {
          for (const m of requiredMonths) {
            ratesByMonth[`${year}-${m}`] = cache[yearStr][String(m)] ?? 40.0;
          }
        } else {
          throw err;
        }
      }
    }
  }

  if (cacheModified) {
    await writeJson(RATES_CACHE_FILE, cache, 0);
  }

  return ratesByMonth;
}

/** Builds (year, month) -> column index map by scanning row 1 of budget sheet. */
function buildDateToColumnMap(rows: unknown[][]): Map<string, number> {
  const map = new Map<string, number>();
  const headerRow = rows[1] || [];
  for (let col = 2; col < headerRow.length; col++) {
    const val = headerRow[col];
    if (val != null) {
      if (typeof val === 'number') {
        // Excel serial date format
        const dateObj = XLSX.SSF.parse_date_code(val);
        if (dateObj?.y && dateObj.m) {
          map.set(`${dateObj.y}-${dateObj.m}`, col);
        }
      } else {
        const dt = new Date(String(val));
        if (!Number.isNaN(dt.getTime())) {
          map.set(`${dt.getFullYear()}-${dt.getMonth() + 1}`, col);
        }
      }
    }
  }
  return map;
}

/** Extracts discrete monthly differences from cumulative year-to-date budget rows. */
function extractMonthlyDifferences(rows: unknown[][], rowIdx: number, year: number, months: number[], dateToCol: Map<string, number>): Record<number, number> {
  const rawVals: number[] = [];
  for (const m of months) {
    const c = dateToCol.get(`${year}-${m}`);
    const cellVal = c != null && rows[rowIdx] ? rows[rowIdx][c] : 0;
    const num = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal)) || 0;
    rawVals.push(num);
  }

  const deltas: Record<number, number> = {};
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (i === 0) {
      deltas[m] = rawVals[0];
    } else {
      deltas[m] = rawVals[i] - rawVals[i - 1];
    }
  }
  return deltas;
}

/** Parses sheet '1.1' of ZB_q_UAH.xlsx to extract Total Gross External Debt in billion UAH. */
function loadDebtData(filePath: string, targetYears: number[]): Record<number, number> {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets['1.1'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];

  let debtRow = 95;
  for (let r = 0; r < rows.length; r++) {
    const txt = String(rows[r]?.[0] || '').toLowerCase();
    if (txt.includes('разом') && txt.includes('всього')) {
      debtRow = r;
      break;
    }
  }

  const yearLatestCol = new Map<number, number>();
  const yearRow = rows[4] || [];
  for (let c = 2; c < yearRow.length; c++) {
    const val = yearRow[c];
    if (val != null) {
      const parsedYear = parseInt(String(val), 10);
      if (!Number.isNaN(parsedYear)) {
        yearLatestCol.set(parsedYear, c);
      }
    }
  }

  const result: Record<number, number> = {};
  for (const y of targetYears) {
    const col = yearLatestCol.get(y);
    if (col != null && rows[debtRow]?.[col] != null) {
      const valM = parseFloat(String(rows[debtRow][col])) || 0;
      result[y] = valM / 1000.0;
    } else {
      result[y] = 0;
    }
  }
  return result;
}

/** Parses sheet 'GDP_1996-2025' from GDP_y.xlsx to extract Nominal GDP in billion UAH. */
function loadGdpData(filePath: string, targetYears: number[]): Record<number, number> {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((s: string) => s.includes('GDP_')) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];

  const yearsRow = (rows[1] || []).slice(2);
  const gdpRow = (rows[4] || []).slice(2);

  const result: Record<number, number> = {};
  for (let i = 0; i < yearsRow.length; i++) {
    const y = parseInt(String(yearsRow[i]), 10);
    const v = parseFloat(String(gdpRow[i]));
    if (!Number.isNaN(y) && targetYears.includes(y) && !Number.isNaN(v) && v > 0) {
      result[y] = v / 1000.0;
    }
  }
  return result;
}

/** Loads Foreign Trade data (exports and imports) by partner from Trade_y.xlsx. */
function loadTradeData(budgetYears: number[]): {
  tradeYears: number[];
  totalExports: number[];
  totalImports: number[];
  tradeBalance: number[];
  exports: TradePartnerTuple[][];
  imports: TradePartnerTuple[][];
} {
  const wb = XLSX.readFile(TRADE_FILE);
  const expSheet = wb.Sheets['1.10'];
  const impSheet = wb.Sheets['1.11'];

  function processTradeSheet(sheet: WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
    const yMap = new Map<number, number>();
    const headerRow = rows[5] || [];
    for (let col = 7; col < headerRow.length; col++) {
      const val = headerRow[col];
      if (val == null || String(val).trim() === '') break;
      const num = Number(val);
      if (Number.isNaN(num) || num < 1990 || num > 2100) break;
      const y = Math.floor(num);
      if (!yMap.has(y)) {
        yMap.set(y, col);
      }
    }

    const validYears = budgetYears.filter((y) => yMap.has(y));
    const totals: Record<number, number> = {};

    for (const y of validYears) {
      const col = yMap.get(y)!;
      totals[y] = (parseFloat(String(rows[6]?.[col])) || 0) / 1000.0;
    }

    const countriesData: Record<string, Record<number, number>> = {};
    for (let r = 7; r <= Math.min(42, rows.length); r++) {
      const rawName = String(rows[r]?.[5] || '').trim();
      if (!rawName || rawName === 'TOTAL' || rawName === 'null') continue;
      const cCode = resolveRegionCode(rawName);
      countriesData[cCode] = {};
      for (const y of validYears) {
        const col = yMap.get(y)!;
        countriesData[cCode][y] = (parseFloat(String(rows[r]?.[col])) || 0) / 1000.0;
      }
    }
    return { validYears, totals, countries: countriesData };
  }

  const expData = processTradeSheet(expSheet);
  const impData = processTradeSheet(impSheet);
  const tradeYears = expData.validYears.filter((y) => impData.validYears.includes(y));

  // Collect all unique sovereign partner country codes across exports and imports
  const allCountryCodes = new Set<string>([...Object.keys(expData.countries), ...Object.keys(impData.countries)]);
  allCountryCodes.delete('Others');

  const tExp = tradeYears.map((y) => Math.round(expData.totals[y] * 10) / 10);
  const tImp = tradeYears.map((y) => Math.round(impData.totals[y] * 10) / 10);
  const saldo = tradeYears.map((_, i) => Math.round((tExp[i] - tImp[i]) * 10) / 10);

  // Per-year breakdowns sorted descending by value: [countryCode, value, share]
  const exports: TradePartnerTuple[][] = [];
  const imports: TradePartnerTuple[][] = [];

  for (let i = 0; i < tradeYears.length; i++) {
    const y = tradeYears[i];
    const totE = tExp[i];
    const totI = tImp[i];

    const yearExp: TradePartnerTuple[] = [];
    for (const code of allCountryCodes) {
      const val = expData.countries[code]?.[y] || 0;
      const roundedVal = Math.round(val * 10) / 10;
      if (roundedVal > 0) {
        const share = totE > 0 ? Math.round((roundedVal / totE) * 1000) / 10 : 0;
        yearExp.push([code, roundedVal, share]);
      }
    }
    yearExp.sort((a, b) => b[1] - a[1]);
    exports.push(yearExp);

    const yearImp: TradePartnerTuple[] = [];
    for (const code of allCountryCodes) {
      const val = impData.countries[code]?.[y] || 0;
      const roundedVal = Math.round(val * 10) / 10;
      if (roundedVal > 0) {
        const share = totI > 0 ? Math.round((roundedVal / totI) * 1000) / 10 : 0;
        yearImp.push([code, roundedVal, share]);
      }
    }
    yearImp.sort((a, b) => b[1] - a[1]);
    imports.push(yearImp);
  }

  return {
    tradeYears,
    totalExports: tExp,
    totalImports: tImp,
    tradeBalance: saldo,
    exports,
    imports,
  };
}

/** Runs the Ukraine ETL Pipeline. Parses budget execution, sovereign debt, GDP, and trade structure, and saves the structured dataset to site/src/data/ukraine.json. */
export async function runUkrainePipeline(forceUpdate = false, verbose?: boolean): Promise<UkraineDataset> {
  return runWithLogger(
    'ukraine',
    async () => {
      const logger = getLogger();
      logger.start('Starting Ukraine ETL pipeline');

      await ensureDataFiles(forceUpdate);

      const budgetWb = XLSX.readFile(BUDGET_FILE);
      const revSheet = budgetWb.Sheets['1'];
      const expSheet = budgetWb.Sheets['4'];
      const finSheet = budgetWb.Sheets['7'];

      const dfRev = XLSX.utils.sheet_to_json(revSheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
      const dfExp = XLSX.utils.sheet_to_json(expSheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
      const dfFin = XLSX.utils.sheet_to_json(finSheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];

      const dateToCol = buildDateToColumnMap(dfRev);

      const yearsMonths: Record<number, number[]> = {};
      for (const [key, col] of dateToCol.entries()) {
        const [y, m] = key.split('-').map(Number);
        if (y >= START_YEAR) {
          const revVal = dfRev[2]?.[col];
          if (revVal != null && Number(revVal) !== 0) {
            if (!yearsMonths[y]) yearsMonths[y] = [];
            yearsMonths[y].push(m);
          }
        }
      }

      const budgetYears = Object.keys(yearsMonths)
        .map(Number)
        .sort((a, b) => a - b);
      const rates = await getMonthlyExchangeRates(yearsMonths, forceUpdate);
      const debtUahByYear = loadDebtData(DEBT_FILE, budgetYears);
      const gdpUahByYear = loadGdpData(GDP_FILE, budgetYears);

      const defenseVals: number[] = [];
      const otherExpVals: number[] = [];
      const totalExpVals: number[] = [];
      const domesticRevVals: number[] = [];
      const grantsVals: number[] = [];
      const loansVals: number[] = [];
      const totalRevFinVals: number[] = [];
      const debtVals: number[] = [];
      const gdpList: (number | null)[] = [];
      const weightedRates: number[] = [];
      const yearLabels: string[] = [];
      const balances: number[] = [];

      for (const year of budgetYears) {
        const months = yearsMonths[year];
        const defM = extractMonthlyDifferences(dfExp, 3, year, months, dateToCol);
        const totExpM = extractMonthlyDifferences(dfExp, 14, year, months, dateToCol);
        const totRevM = extractMonthlyDifferences(dfRev, 2, year, months, dateToCol);
        const grantsM = extractMonthlyDifferences(dfRev, 31, year, months, dateToCol);
        const trustM = extractMonthlyDifferences(dfRev, 32, year, months, dateToCol);
        const extLoanM = extractMonthlyDifferences(dfFin, 11, year, months, dateToCol);

        let defUsdSum = 0;
        let othersUsdSum = 0;
        let totExpUsdSum = 0;
        let totExpUahSum = 0;
        let intRevUsdSum = 0;
        let grantsUsdSum = 0;
        let trustUsdSum = 0;
        let loanUsdSum = 0;

        for (const m of months) {
          const rate = rates[`${year}-${m}`] || 40.0;
          const defUah = defM[m] || 0;
          const totExpUah = totExpM[m] || 0;
          const othersUah = totExpUah - defUah;

          defUsdSum += defUah / 1000.0 / rate;
          othersUsdSum += othersUah / 1000.0 / rate;
          totExpUsdSum += totExpUah / 1000.0 / rate;
          totExpUahSum += totExpUah / 1000.0;

          const totRevUah = totRevM[m] || 0;
          const grantsUah = grantsM[m] || 0;
          const trustUah = trustM[m] || 0;
          const intRevUah = totRevUah - grantsUah - trustUah;
          const extLoanUah = extLoanM[m] || 0;

          intRevUsdSum += intRevUah / 1000.0 / rate;
          grantsUsdSum += grantsUah / 1000.0 / rate;
          trustUsdSum += trustUah / 1000.0 / rate;
          loanUsdSum += extLoanUah / 1000.0 / rate;
        }

        const weightedRate = totExpUsdSum > 0 ? Math.round((totExpUahSum / totExpUsdSum) * 100) / 100 : 0;
        weightedRates.push(weightedRate);

        const labelYear = months.length < 12 ? `${year} (${months.length} months)` : String(year);
        yearLabels.push(labelYear);

        const lastM = months[months.length - 1];
        const rateLastM = rates[`${year}-${lastM}`] || 40.0;
        const debtUah = debtUahByYear[year] || 0;
        const debtUsd = debtUah / rateLastM;
        debtVals.push(Math.round(debtUsd * 10) / 10);

        const gdpUah = gdpUahByYear[year];
        const gdpUsd = gdpUah != null && weightedRate > 0 ? Math.round((gdpUah / weightedRate) * 10) / 10 : null;
        gdpList.push(gdpUsd);

        const dVal = Math.round(defUsdSum * 10) / 10;
        const oVal = Math.round(othersUsdSum * 10) / 10;
        const expVal = Math.round(totExpUsdSum * 10) / 10;
        defenseVals.push(dVal);
        otherExpVals.push(oVal);
        totalExpVals.push(expVal);

        const domVal = Math.round(intRevUsdSum * 10) / 10;
        const nonLoanUsd = Math.round((grantsUsdSum + trustUsdSum) * 10) / 10;
        const lVal = Math.round(loanUsdSum * 10) / 10;
        domesticRevVals.push(domVal);
        grantsVals.push(nonLoanUsd);
        loansVals.push(lVal);
        totalRevFinVals.push(Math.round((domVal + nonLoanUsd + lVal) * 10) / 10);

        balances.push(Math.round((domVal + nonLoanUsd - expVal) * 100) / 100);
      }

      const roundPct = (num: number, denom: number): number => (denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0);
      const roundGdpPct = (num: number, gdp: number | null): number | null => (gdp != null && gdp > 0 ? Math.round((num / gdp) * 1000) / 10 : null);

      const defensePct = defenseVals.map((d, i) => roundPct(d, totalExpVals[i]));
      const otherExpPct = otherExpVals.map((o, i) => roundPct(o, totalExpVals[i]));
      const domesticRevPct = domesticRevVals.map((r, i) => roundPct(r, totalRevFinVals[i]));
      const grantsPct = grantsVals.map((g, i) => roundPct(g, totalRevFinVals[i]));
      const loansPct = loansVals.map((l, i) => roundPct(l, totalRevFinVals[i]));

      const expGdpPct = gdpList.map((gdp, i) => roundGdpPct(totalExpVals[i], gdp));
      const revGdpPct = gdpList.map((gdp, i) => roundGdpPct(totalRevFinVals[i], gdp));
      const debtGdpPct = gdpList.map((gdp, i) => roundGdpPct(debtVals[i], gdp));

      const trade = loadTradeData(budgetYears);

      const dataset: UkraineDataset = {
        budgetDebt: {
          years: budgetYears,
          yearLabels,
          rates: weightedRates,
          balances,
          gdp: gdpList,
          expGdpPct,
          revGdpPct,
          debtGdpPct,
          defense: defenseVals,
          defensePct,
          otherExp: otherExpVals,
          otherExpPct,
          totalExp: totalExpVals,
          domesticRev: domesticRevVals,
          domesticRevPct,
          grants: grantsVals,
          grantsPct,
          loans: loansVals,
          loansPct,
          totalRevFin: totalRevFinVals,
          debt: debtVals,
        },
        trade: {
          years: trade.tradeYears,
          totalExports: trade.totalExports,
          totalImports: trade.totalImports,
          tradeBalance: trade.tradeBalance,
          exports: trade.exports,
          imports: trade.imports,
        },
      };

      await writeJson(OUTPUT_FILE, dataset, 0);
      await updateMetadata('ukraine');
      logger.success(`Exported ukraine dataset (${budgetYears[0]}–${budgetYears[budgetYears.length - 1]} budget & trade series)`);
      return dataset;
    },
    verbose,
  );
}

export { runUkrainePipeline as runUaEconomicPipeline };

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runUkrainePipeline().catch((err) => {
    getLogger('ukraine').error('Fatal error running Ukraine pipeline:', err);
    process.exit(1);
  });
}
