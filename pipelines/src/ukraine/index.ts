import type { BudgetDebtSectionData } from '@graphs/types/ukraine/budget-and-debt';
import type { TradeCategoriesSectionData, TradeCategoryId, TradeCategoryTuple } from '@graphs/types/ukraine/trade-categories';
import type { TradePartnersSectionData, TradePartnerTuple } from '@graphs/types/ukraine/trade-partners';
import type { TradeStructureSectionData } from '@graphs/types/ukraine/trade-structure';
import XLSX, { type WorkSheet } from 'xlsx';
import { exportProjectSections, getPipelineDataPath } from '@/utils/dataset';
import { fileExists, readJson, writeJson } from '@/utils/fs';
import { fetchBinaryWithMeta, fetchHeadMeta, fetchWithRetry, isRemoteMetaEqual, type RemoteFileMeta } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { percentage, percentageNullable, round, scaleMagnitude } from '@/utils/math';
import { resolveRegionCode } from '@/utils/region';

const DATA_FILE = getPipelineDataPath('ukraine');

const URL_BUDGET = 'https://bank.gov.ua/files/macro/C_budget_m.xlsx';
const URL_TRADE = 'https://bank.gov.ua/files/ES/Trade_y.xlsx';
const URL_DEBT_Q = 'https://bank.gov.ua/files/ES/ZB_q_UAH.xlsx';
const URL_DEBT_Y = 'https://bank.gov.ua/files/ES/ZB_y_UAH.xlsx';
const URL_GDP = 'https://bank.gov.ua/files/macro/GDP_y.xlsx';

interface UkrainePipelineCache {
  meta?: Record<string, RemoteFileMeta>;
  rates: Record<string, Record<string, number>>;
  sections: {
    'budget-and-debt': BudgetDebtSectionData;
    'trade-structure': TradeStructureSectionData;
    'trade-partners': TradePartnersSectionData;
    'trade-categories': TradeCategoriesSectionData;
  };
}

/** Exports section datasets for ukraine. */
async function exportUkraine(sections: UkrainePipelineCache['sections']): Promise<void> {
  await exportProjectSections('ukraine', sections);
}

/** Fetches monthly average USD/UAH exchange rates from NBU API, reusing cached historical rates. */
async function getMonthlyExchangeRates(
  yearsMonths: Record<number, number[]>,
  cachedRates: Record<string, Record<string, number>> = {},
  forceUpdate = false,
): Promise<{ ratesByMonth: Record<string, number>; updatedCache: Record<string, Record<string, number>> }> {
  const logger = getLogger();
  const currentYear = new Date().getFullYear();
  const ratesByMonth: Record<string, number> = {};
  const updatedCache: Record<string, Record<string, number>> = { ...cachedRates };

  for (const year of Object.keys(yearsMonths)
    .map(Number)
    .sort((a, b) => a - b)) {
    const yearStr = String(year);
    const requiredMonths = yearsMonths[year];
    const hasAllMonths = yearStr in updatedCache && requiredMonths.every((m) => String(m) in updatedCache[yearStr]);

    if (!forceUpdate && year < currentYear && hasAllMonths) {
      for (const m of requiredMonths) {
        ratesByMonth[`${year}-${m}`] = updatedCache[yearStr][String(m)];
      }
    } else {
      logger.debug(`Fetching USD/UAH rates for ${year} from NBU API...`);
      try {
        const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${year}0101&end=${year}1231&valcode=usd&sort=exchangedate&order=asc&json`;
        const res = await fetchWithRetry(url, { retries: 2, timeoutMs: 20000 });
        if (res.ok) {
          const data = (await res.json()) as Array<{ exchangedate?: string; rate?: number; rate_per_unit?: number; units?: number }>;
          const monthVals: Record<number, number[]> = {};
          for (const item of data) {
            if (item.exchangedate && (item.rate != null || item.rate_per_unit != null)) {
              const parts = item.exchangedate.split('.');
              if (parts.length === 3) {
                const m = parseInt(parts[1], 10);
                if (!monthVals[m]) monthVals[m] = [];
                const rateVal = item.rate_per_unit ?? (item.units ? item.rate! / item.units : item.rate!);
                monthVals[m].push(rateVal);
              }
            }
          }

          const yearRates = updatedCache[yearStr] || {};
          for (const [m, vals] of Object.entries(monthVals)) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            ratesByMonth[`${year}-${m}`] = avg;
            yearRates[m] = avg;
          }
          updatedCache[yearStr] = yearRates;
        }
      } catch (err) {
        logger.warn(`Could not fetch rates for ${year}: ${err}`);
        if (yearStr in updatedCache) {
          for (const m of requiredMonths) {
            ratesByMonth[`${year}-${m}`] = updatedCache[yearStr][String(m)] ?? 40.0;
          }
        } else {
          throw err;
        }
      }
    }
  }

  return { ratesByMonth, updatedCache };
}

/** Builds (year, month) -> column index map by scanning row 1 of budget sheet. */
function buildDateToColumnMap(rows: unknown[][]): Map<string, number> {
  const map = new Map<string, number>();
  const headerRow = rows[1] || [];
  for (let col = 2; col < headerRow.length; col++) {
    const val = headerRow[col];
    if (val != null) {
      if (typeof val === 'number') {
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

/** Parses sheet '1.1' from in-memory debt workbooks to extract Total Gross External Debt in billion UAH. */
function loadDebtData(quarterlyWb: XLSX.WorkBook, targetYears: number[], annualWb?: XLSX.WorkBook | null): Record<number, number> {
  const result: Record<number, number> = {};

  if (annualWb) {
    try {
      const sheetY = annualWb.Sheets['1.1'];
      if (sheetY) {
        const rowsY = XLSX.utils.sheet_to_json(sheetY, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
        let debtRowY = 79;
        for (let r = 0; r < rowsY.length; r++) {
          const txt = String(rowsY[r]?.[0] || '').toLowerCase();
          if (txt.includes('валовий') && txt.includes('зовнішній борг')) {
            debtRowY = r;
            break;
          }
        }
        const row5 = rowsY[5] || [];
        for (let c = 1; c < row5.length; c++) {
          const val = row5[c];
          if (typeof val === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(val);
            if (dateObj?.y && rowsY[debtRowY]?.[c] != null) {
              const valM = parseFloat(String(rowsY[debtRowY][c])) || 0;
              result[dateObj.y] = valM / 1000.0;
            }
          }
        }
      }
    } catch {
      // Optional historical annual file fallback
    }
  }

  const sheet = quarterlyWb.Sheets['1.1'];
  if (!sheet) return result;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];

  let debtRow = 95;
  for (let r = 0; r < rows.length; r++) {
    const txt = String(rows[r]?.[0] || '').toLowerCase();
    if (txt.includes('валовий') && txt.includes('зовнішній борг')) {
      debtRow = r;
      break;
    }
  }

  let currentYear: number | null = null;
  const yearLatestCol = new Map<number, number>();
  const yearRow = rows[4] || [];
  const quartersRow = rows[5] || [];

  for (let c = 1; c < quartersRow.length; c++) {
    if (yearRow[c] != null) {
      const parsedYear = parseInt(String(yearRow[c]), 10);
      if (!Number.isNaN(parsedYear)) {
        currentYear = parsedYear;
      }
    }
    if (currentYear != null && rows[debtRow]?.[c] != null) {
      yearLatestCol.set(currentYear, c);
    }
  }

  for (const y of targetYears) {
    const col = yearLatestCol.get(y);
    if (col != null && rows[debtRow]?.[col] != null) {
      const valM = parseFloat(String(rows[debtRow][col])) || 0;
      result[y] = valM / 1000.0;
    } else if (result[y] == null) {
      result[y] = 0;
    }
  }
  return result;
}

/** Parses in-memory GDP workbook to extract Nominal GDP in billion UAH. */
function loadGdpData(gdpWb: XLSX.WorkBook, targetYears: number[]): Record<number, number> {
  const sheetName = gdpWb.SheetNames.find((s: string) => s.includes('GDP_')) || gdpWb.SheetNames[0];
  const sheet = gdpWb.Sheets[sheetName];
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

/** Loads Foreign Trade data (exports and imports) by partner from in-memory trade workbook across all available years. */
function loadTradeData(tradeWb: XLSX.WorkBook): {
  tradeYears: number[];
  totalExports: number[];
  totalImports: number[];
  tradeBalance: number[];
  exports: TradePartnerTuple[][];
  imports: TradePartnerTuple[][];
  categoryExports: TradeCategoryTuple[][];
  categoryImports: TradeCategoryTuple[][];
} {
  const expSheet = tradeWb.Sheets['1.10'];
  const impSheet = tradeWb.Sheets['1.11'];
  const expCatSheet = tradeWb.Sheets['1.1 '];
  const impCatSheet = tradeWb.Sheets['1.2'];

  function processTradeSheet(sheet: WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
    const yMap = new Map<number, number>();
    const headerRow = rows[5] || [];
    for (let col = 6; col < headerRow.length; col++) {
      const val = headerRow[col];
      if (val == null || String(val).trim() === '') break;
      const num = Number(val);
      if (Number.isNaN(num) || num < 1990 || num > 2100) break;
      const y = Math.floor(num);
      if (!yMap.has(y)) {
        yMap.set(y, col);
      }
    }

    const validYears = Array.from(yMap.keys()).sort((a, b) => a - b);
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

  const tExp = tradeYears.map((y) => round(expData.totals[y], 1));
  const tImp = tradeYears.map((y) => round(impData.totals[y], 1));
  const saldo = tradeYears.map((_, i) => round(tExp[i] - tImp[i], 1));

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
      const roundedVal = round(val, 1);
      if (roundedVal > 0) {
        const share = percentage(roundedVal, totE, 1);
        yearExp.push([code, roundedVal, share]);
      }
    }
    yearExp.sort((a, b) => b[1] - a[1]);
    exports.push(yearExp);

    const yearImp: TradePartnerTuple[] = [];
    for (const code of allCountryCodes) {
      const val = impData.countries[code]?.[y] || 0;
      const roundedVal = round(val, 1);
      if (roundedVal > 0) {
        const share = percentage(roundedVal, totI, 1);
        yearImp.push([code, roundedVal, share]);
      }
    }
    yearImp.sort((a, b) => b[1] - a[1]);
    imports.push(yearImp);
  }

  // Parse commodity category dynamics from sheets '1.1 ' (exports) and '1.2' (imports)
  const expCatRows = XLSX.utils.sheet_to_json(expCatSheet, { header: 1, raw: true, blankrows: false, defval: null }) as unknown[][];
  const impCatRows = XLSX.utils.sheet_to_json(impCatSheet, { header: 1, raw: true, blankrows: false, defval: null }) as unknown[][];

  const catHeaderRow = expCatRows[4] || [];
  const catYearCols = new Map<number, number>();
  for (let c = 3; c < catHeaderRow.length; c++) {
    const y = parseInt(String(catHeaderRow[c]), 10);
    if (!Number.isNaN(y)) catYearCols.set(y, c);
  }

  const CATEGORY_ROWS: { id: TradeCategoryId; row: number }[] = [
    { id: 'agriculture', row: 6 },
    { id: 'minerals', row: 7 },
    { id: 'chemicals', row: 8 },
    { id: 'timber', row: 9 },
    { id: 'manufactured', row: 10 },
    { id: 'metals', row: 11 },
    { id: 'machinery', row: 12 },
    { id: 'other', row: 13 },
  ];

  // Per-year commodity category breakdowns sorted descending by value: [categoryId, value, share]
  const categoryExports: TradeCategoryTuple[][] = [];
  const categoryImports: TradeCategoryTuple[][] = [];

  for (let i = 0; i < tradeYears.length; i++) {
    const y = tradeYears[i];
    const col = catYearCols.get(y);
    const totE = tExp[i];
    const totI = tImp[i];

    const yearCatExp: TradeCategoryTuple[] = [];
    const yearCatImp: TradeCategoryTuple[] = [];

    for (const { id, row } of CATEGORY_ROWS) {
      const expVal = col != null ? (Number(expCatRows[row]?.[col]) || 0) / 1000.0 : 0;
      const impVal = col != null ? (Number(impCatRows[row]?.[col]) || 0) / 1000.0 : 0;
      const roundedExp = round(expVal, 1);
      const roundedImp = round(impVal, 1);

      if (roundedExp > 0) {
        const share = percentage(roundedExp, totE, 1);
        yearCatExp.push([id, roundedExp, share]);
      }
      if (roundedImp > 0) {
        const share = percentage(roundedImp, totI, 1);
        yearCatImp.push([id, roundedImp, share]);
      }
    }

    yearCatExp.sort((a, b) => b[1] - a[1]);
    yearCatImp.sort((a, b) => b[1] - a[1]);

    categoryExports.push(yearCatExp);
    categoryImports.push(yearCatImp);
  }

  return {
    tradeYears,
    totalExports: tExp,
    totalImports: tImp,
    tradeBalance: saldo,
    exports,
    imports,
    categoryExports,
    categoryImports,
  };
}

/** Runs the Ukraine ETL Pipeline. Parses budget execution, sovereign debt, GDP, and trade structure entirely in memory, outputting to section data files. */
export async function runUkrainePipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'ukraine',
    async () => {
      const logger = getLogger();
      logger.start('Starting Ukraine ETL pipeline');

      let existingCache: UkrainePipelineCache | null = null;
      if (await fileExists(DATA_FILE)) {
        try {
          existingCache = await readJson<UkrainePipelineCache>(DATA_FILE);
        } catch {
          logger.warn('Could not read existing data.json file');
        }
      }

      const hasValidDataset = Boolean(existingCache?.sections?.['budget-and-debt']?.years?.length) && Boolean(existingCache?.sections?.['trade-structure']?.years?.length);

      const allUrls = [URL_BUDGET, URL_TRADE, URL_DEBT_Q, URL_DEBT_Y, URL_GDP];

      // Fast check: verify if remote files are unchanged via HTTP HEAD
      if (!forceUpdate && hasValidDataset && existingCache?.meta) {
        logger.debug('Checking NBU file metadata via HTTP HEAD...');
        const remoteMetas = await Promise.all(allUrls.map((url) => fetchHeadMeta(url)));
        const networkFailed = remoteMetas.every((m) => m === null);

        if (networkFailed) {
          logger.warn('NBU server unreachable (offline). Using cached dataset.');
          await exportUkraine(existingCache.sections);
          return;
        }

        const allUnchanged = allUrls.every((url, i) => isRemoteMetaEqual(existingCache.meta?.[url], remoteMetas[i]));

        if (allUnchanged) {
          logger.info('All NBU source files are unchanged (matching remote ETags). Using cached dataset.');
          await exportUkraine(existingCache.sections);
          return;
        }

        logger.info('NBU source files updated upstream. Downloading updated workbooks...');
      }

      let budgetWb: XLSX.WorkBook;
      let tradeWb: XLSX.WorkBook;
      let debtWb: XLSX.WorkBook;
      let debtAnnualWb: XLSX.WorkBook | null = null;
      let gdpWb: XLSX.WorkBook;
      const newMeta: Record<string, RemoteFileMeta> = { ...(existingCache?.meta || {}) };

      try {
        const [bRes, tRes, dRes, gRes] = await Promise.all([fetchBinaryWithMeta(URL_BUDGET), fetchBinaryWithMeta(URL_TRADE), fetchBinaryWithMeta(URL_DEBT_Q), fetchBinaryWithMeta(URL_GDP)]);

        newMeta[URL_BUDGET] = bRes.meta;
        newMeta[URL_TRADE] = tRes.meta;
        newMeta[URL_DEBT_Q] = dRes.meta;
        newMeta[URL_GDP] = gRes.meta;

        budgetWb = XLSX.read(bRes.buffer, { type: 'buffer' });
        tradeWb = XLSX.read(tRes.buffer, { type: 'buffer' });
        debtWb = XLSX.read(dRes.buffer, { type: 'buffer' });
        gdpWb = XLSX.read(gRes.buffer, { type: 'buffer' });

        try {
          const dyRes = await fetchBinaryWithMeta(URL_DEBT_Y);
          debtAnnualWb = XLSX.read(dyRes.buffer, { type: 'buffer' });
          newMeta[URL_DEBT_Y] = dyRes.meta;
        } catch {
          logger.debug('Optional annual debt file fetch skipped');
        }
      } catch (networkErr) {
        if (hasValidDataset && existingCache?.sections) {
          logger.warn(`Network fetch failed (${(networkErr as Error).message}). Using cached data.`);
          await exportUkraine(existingCache.sections);
          return;
        }
        throw new Error(`Failed to fetch Ukraine data from NBU and no local cache exists: ${(networkErr as Error).message}`);
      }

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
        const revVal = dfRev[2]?.[col];
        if (revVal != null && Number(revVal) !== 0) {
          if (!yearsMonths[y]) yearsMonths[y] = [];
          yearsMonths[y].push(m);
        }
      }

      for (const y of Object.keys(yearsMonths)) {
        yearsMonths[Number(y)].sort((a, b) => a - b);
      }

      const budgetYears = Object.keys(yearsMonths)
        .map(Number)
        .sort((a, b) => a - b);

      const { ratesByMonth: rates, updatedCache: ratesCache } = await getMonthlyExchangeRates(yearsMonths, existingCache?.rates, forceUpdate);

      const debtUahByYear = loadDebtData(debtWb, budgetYears, debtAnnualWb);
      const gdpUahByYear = loadGdpData(gdpWb, budgetYears);

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

          defUsdSum += scaleMagnitude(defUah, 1, rate);
          othersUsdSum += scaleMagnitude(othersUah, 1, rate);
          totExpUsdSum += scaleMagnitude(totExpUah, 1, rate);
          totExpUahSum += scaleMagnitude(totExpUah, 1);

          const totRevUah = totRevM[m] || 0;
          const grantsUah = grantsM[m] || 0;
          const trustUah = trustM[m] || 0;
          const intRevUah = totRevUah - grantsUah - trustUah;
          const extLoanUah = extLoanM[m] || 0;

          intRevUsdSum += scaleMagnitude(intRevUah, 1, rate);
          grantsUsdSum += scaleMagnitude(grantsUah, 1, rate);
          trustUsdSum += scaleMagnitude(trustUah, 1, rate);
          loanUsdSum += scaleMagnitude(extLoanUah, 1, rate);
        }

        const weightedRate = totExpUsdSum > 0 ? round(totExpUahSum / totExpUsdSum, 2) : 0;
        weightedRates.push(weightedRate);

        const labelYear = months.length < 12 ? `${year} (${months.length}m)` : String(year);
        yearLabels.push(labelYear);

        const lastM = months[months.length - 1];
        const rateLastM = rates[`${year}-${lastM}`] || 40.0;
        const debtUah = debtUahByYear[year] || 0;
        const debtUsd = debtUah > 0 ? debtUah / rateLastM : 0;
        debtVals.push(round(debtUsd, 1));

        const gdpUah = gdpUahByYear[year];
        const gdpUsd = gdpUah != null && weightedRate > 0 ? round(gdpUah / weightedRate, 1) : null;
        gdpList.push(gdpUsd);

        const dVal = round(defUsdSum, 1);
        const oVal = round(othersUsdSum, 1);
        const expVal = round(totExpUsdSum, 1);
        defenseVals.push(dVal);
        otherExpVals.push(oVal);
        totalExpVals.push(expVal);

        const domVal = round(intRevUsdSum, 1);
        const nonLoanUsd = round(grantsUsdSum + trustUsdSum, 1);
        const lVal = round(Math.max(0, loanUsdSum), 1);
        domesticRevVals.push(domVal);
        grantsVals.push(nonLoanUsd);
        loansVals.push(lVal);
        totalRevFinVals.push(round(domVal + nonLoanUsd + lVal, 1));

        balances.push(round(domVal + nonLoanUsd - expVal, 2));
      }

      const defensePct = defenseVals.map((d, i) => percentage(d, totalExpVals[i], 1));
      const otherExpPct = otherExpVals.map((o, i) => percentage(o, totalExpVals[i], 1));
      const domesticRevPct = domesticRevVals.map((r, i) => percentage(r, totalRevFinVals[i], 1));
      const grantsPct = grantsVals.map((g, i) => percentage(g, totalRevFinVals[i], 1));
      const loansPct = loansVals.map((l, i) => percentage(l, totalRevFinVals[i], 1));

      const expGdpPct = gdpList.map((gdp, i) => percentageNullable(totalExpVals[i], gdp, 1));
      const revGdpPct = gdpList.map((gdp, i) => percentageNullable(totalRevFinVals[i], gdp, 1));
      const debtGdpPct = gdpList.map((gdp, i) => percentageNullable(debtVals[i], gdp, 1));

      const trade = loadTradeData(tradeWb);

      const budgetDebtSectionData: BudgetDebtSectionData = {
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
      };

      const tradeStructureSectionData: TradeStructureSectionData = {
        years: trade.tradeYears,
        totalExports: trade.totalExports,
        totalImports: trade.totalImports,
        tradeBalance: trade.tradeBalance,
      };

      const tradePartnersSectionData: TradePartnersSectionData = {
        years: trade.tradeYears,
        totalExports: trade.totalExports,
        totalImports: trade.totalImports,
        exports: trade.exports,
        imports: trade.imports,
      };

      const tradeCategoriesSectionData: TradeCategoriesSectionData = {
        years: trade.tradeYears,
        totalExports: trade.totalExports,
        totalImports: trade.totalImports,
        categoryExports: trade.categoryExports,
        categoryImports: trade.categoryImports,
      };

      const sections = {
        'budget-and-debt': budgetDebtSectionData,
        'trade-structure': tradeStructureSectionData,
        'trade-partners': tradePartnersSectionData,
        'trade-categories': tradeCategoriesSectionData,
      };

      await writeJson(DATA_FILE, { meta: newMeta, rates: ratesCache, sections }, 0);
      await exportUkraine(sections);
      logger.success(`Exported ukraine section datasets (${budgetYears[0]}–${budgetYears[budgetYears.length - 1]} budget & trade series)`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runUkrainePipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('ukraine').error('Fatal error running Ukraine pipeline:', err);
    process.exit(1);
  });
}
