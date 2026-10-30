import type {
  MacroGrowthSectionData,
  MacroSectionData,
  TradeCategoriesSectionData,
  TradeCategoryId,
  TradeCategoryTuple,
  TradePartnersSectionData,
  TradePartnerTuple,
  TradeStructureSectionData,
  UkraineDataset,
} from '@graphs/shared/types/ukraine';
import XLSX, { type WorkSheet } from 'xlsx';
import { ensurePipelineL1, fileExists, getRawDataPath, readJson, writeJsonAsyncToR2, writeJsonAsyncToSite } from '@/utils/fs';
import { fetchBinaryWithMeta, fetchHeadMeta, fetchWithRetry, isRemoteMetaEqual, type RemoteFileMeta } from '@/utils/http';
import { getPipelineLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { percentage, percentageNullable, round, scaleMagnitude } from '@/utils/math';
import { updateMetadata } from '@/utils/metadata';
import { resolveRegionCode } from '@/utils/region';

const DATA_FILE = getRawDataPath('ukraine');

const URL_BUDGET = 'https://bank.gov.ua/files/macro/C_budget_m.xlsx';
const URL_TRADE = 'https://bank.gov.ua/files/ES/Trade_y.xlsx';
const URL_TRADE_M = 'https://bank.gov.ua/files/ES/Trade_m.xlsx';
const URL_DEBT_Q = 'https://bank.gov.ua/files/ES/ZB_q_UAH.xlsx';
const URL_DEBT_Y = 'https://bank.gov.ua/files/ES/ZB_y_UAH.xlsx';
const URL_GDP = 'https://bank.gov.ua/files/macro/GDP_y.xlsx';

interface UkrainePipelineCache {
  meta?: Record<string, RemoteFileMeta>;
  rates: Record<string, Record<string, number>>;
  sections: {
    macro: MacroSectionData;
    'macro-growth': MacroGrowthSectionData;
    'trade-structure': TradeStructureSectionData;
    'trade-partners': TradePartnersSectionData;
    'trade-categories': TradeCategoriesSectionData;
  };
}

/** Precomputes Year-over-Year (YoY %) growth rates in USD for key macroeconomic indicators across full calendar years. */
function computeMacroGrowthData(macro: MacroSectionData): MacroGrowthSectionData {
  const fullYearIndices = macro.years
    .map((y, idx) => ({ y, idx }))
    .filter((_, idx) => !macro.yearLabels[idx]?.includes('('))
    .map(({ idx }) => idx);

  const growthIndices = fullYearIndices.slice(1);
  const years = growthIndices.map((i) => macro.years[i]);

  const calcYoy = (vals: (number | null)[], prevI: number, currI: number): number | null => {
    const prev = vals[prevI];
    const curr = vals[currI];
    if (prev == null || curr == null || prev <= 0) return null;
    return round(((curr - prev) / prev) * 100, 1);
  };

  const calcDiff = (vals: (number | null)[], prevI: number, currI: number): number | null => {
    const prev = vals[prevI];
    const curr = vals[currI];
    if (prev == null || curr == null || prev < 0) return null;
    return round(curr - prev, 1);
  };

  const externalFinVals = macro.grants.map((g, i) => g + macro.loans[i]);

  return {
    years,
    gdpYoy: growthIndices.map((i) => calcYoy(macro.gdp, i - 1, i)),
    gdpDiff: growthIndices.map((i) => calcDiff(macro.gdp, i - 1, i)),
    gdpVal: growthIndices.map((i) => macro.gdp[i]),
    realGdpYoy: growthIndices.map((i) => (macro.realGdpGrowth ? macro.realGdpGrowth[i] : null)),
    domesticRevYoy: growthIndices.map((i) => calcYoy(macro.domesticRev, i - 1, i)),
    domesticRevDiff: growthIndices.map((i) => calcDiff(macro.domesticRev, i - 1, i)),
    domesticRevVal: growthIndices.map((i) => macro.domesticRev[i]),
    externalFinYoy: growthIndices.map((i) => calcYoy(externalFinVals, i - 1, i)),
    externalFinDiff: growthIndices.map((i) => calcDiff(externalFinVals, i - 1, i)),
    externalFinVal: growthIndices.map((i) => round(externalFinVals[i], 1)),
    defenseYoy: growthIndices.map((i) => calcYoy(macro.defense, i - 1, i)),
    defenseDiff: growthIndices.map((i) => calcDiff(macro.defense, i - 1, i)),
    defenseVal: growthIndices.map((i) => macro.defense[i]),
    totalExpYoy: growthIndices.map((i) => calcYoy(macro.totalExp, i - 1, i)),
    totalExpDiff: growthIndices.map((i) => calcDiff(macro.totalExp, i - 1, i)),
    totalExpVal: growthIndices.map((i) => macro.totalExp[i]),
    govDebtYoy: growthIndices.map((i) => calcYoy(macro.govDebt, i - 1, i)),
    govDebtDiff: growthIndices.map((i) => calcDiff(macro.govDebt, i - 1, i)),
    govDebtVal: growthIndices.map((i) => (macro.govDebt[i] > 0 ? macro.govDebt[i] : null)),
    privateDebtYoy: growthIndices.map((i) => calcYoy(macro.privateDebt, i - 1, i)),
    privateDebtDiff: growthIndices.map((i) => calcDiff(macro.privateDebt, i - 1, i)),
    privateDebtVal: growthIndices.map((i) => (macro.privateDebt[i] > 0 ? macro.privateDebt[i] : null)),
  };
}

/** Exports unified dataset for ukraine. */
async function exportUkraine(sections: UkrainePipelineCache['sections']): Promise<void> {
  if (sections.macro) {
    sections['macro-growth'] = computeMacroGrowthData(sections.macro);
  }
  const minYear = Math.min(sections.macro.years[0], sections['trade-structure'].years[0], sections['trade-partners'].years[0], sections['trade-categories'].years[0]);
  const maxYear = Math.max(
    sections.macro.years[sections.macro.years.length - 1],
    sections['trade-structure'].years[sections['trade-structure'].years.length - 1],
    sections['trade-partners'].years[sections['trade-partners'].years.length - 1],
    sections['trade-categories'].years[sections['trade-categories'].years.length - 1],
  );
  const defaultPeriod: [number, number] = [sections.macro.years[Math.max(0, sections.macro.years.length - 6)], sections.macro.years[sections.macro.years.length - 1]];

  const dataset: UkraineDataset = {
    ...sections,
    minYear,
    maxYear,
    defaultPeriod,
  };
  await writeJsonAsyncToSite('ukraine/data.json', dataset);
  await updateMetadata('ukraine');
}

/** Fetches monthly average USD/UAH exchange rates from NBU API, reusing cached historical rates. */
async function getMonthlyExchangeRates(
  yearsMonths: Record<number, number[]>,
  cachedRates: Record<string, Record<string, number>> = {},
  forceUpdate = false,
): Promise<{ ratesByMonth: Record<string, number>; updatedCache: Record<string, Record<string, number>> }> {
  const logger = getPipelineLogger('ukraine');
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

interface DebtBreakdown {
  total: number;
  gov: number;
  private: number;
}

/** Parses in-memory debt workbooks to extract Gross, Sovereign, and Private External Debt in billion UAH. */
function loadDebtData(quarterlyWb: XLSX.WorkBook, targetYears: number[], annualWb?: XLSX.WorkBook | null): Record<number, DebtBreakdown> {
  const result: Record<number, DebtBreakdown> = {};

  if (annualWb) {
    try {
      const sheetY = annualWb.Sheets['1.1'];
      if (sheetY) {
        const rowsY = XLSX.utils.sheet_to_json(sheetY, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
        let govRowY = 6;
        let nbuRowY = 15;
        let debtRowY = 79;
        for (let r = 0; r < rowsY.length; r++) {
          const txt = String(rowsY[r]?.[0] || '').toLowerCase();
          if (txt.includes('загального державного')) govRowY = r;
          else if (txt.includes('центральний банк')) nbuRowY = r;
          else if (txt.includes('валовий') && txt.includes('зовнішній борг')) debtRowY = r;
        }
        const row5 = rowsY[5] || [];
        for (let c = 1; c < row5.length; c++) {
          const val = row5[c];
          if (typeof val === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(val);
            if (dateObj?.y && rowsY[debtRowY]?.[c] != null) {
              const govM = ((parseFloat(String(rowsY[govRowY]?.[c])) || 0) + (parseFloat(String(rowsY[nbuRowY]?.[c])) || 0)) / 1000.0;
              const totM = (parseFloat(String(rowsY[debtRowY][c])) || 0) / 1000.0;
              result[dateObj.y] = { total: totM, gov: govM, private: Math.max(0, totM - govM) };
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

  let govRow = 6;
  let nbuRow = 21;
  let debtRow = 95;
  for (let r = 0; r < rows.length; r++) {
    const txt = String(rows[r]?.[0] || '').toLowerCase();
    if (txt.includes('загального державного')) govRow = r;
    else if (txt.includes('центральний банк')) nbuRow = r;
    else if (txt.includes('валовий') && txt.includes('зовнішній борг')) debtRow = r;
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
      const govM = ((parseFloat(String(rows[govRow]?.[col])) || 0) + (parseFloat(String(rows[nbuRow]?.[col])) || 0)) / 1000.0;
      const totM = (parseFloat(String(rows[debtRow][col])) || 0) / 1000.0;
      result[y] = { total: totM, gov: govM, private: Math.max(0, totM - govM) };
    } else if (result[y] == null) {
      result[y] = { total: 0, gov: 0, private: 0 };
    }
  }
  return result;
}

interface GdpDataResult {
  nominal: Record<number, number>;
  realGrowth: Record<number, number>;
}

/** Parses in-memory GDP workbook to extract Nominal GDP in billion UAH and Real GDP YoY growth %. */
function loadGdpData(gdpWb: XLSX.WorkBook, targetYears: number[]): GdpDataResult {
  const sheetName = gdpWb.SheetNames.find((s: string) => s.includes('GDP_')) || gdpWb.SheetNames[0];
  const sheet = gdpWb.Sheets[sheetName];
  if (!sheet) return { nominal: {}, realGrowth: {} };
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];

  const yearsRow = (rows[1] || []).slice(2);
  const gdpRow = (rows[4] || []).slice(2);
  const realRow = (rows[7] || []).slice(2);

  const nominal: Record<number, number> = {};
  const realGrowth: Record<number, number> = {};
  for (let i = 0; i < yearsRow.length; i++) {
    const y = parseInt(String(yearsRow[i]), 10);
    const v = parseFloat(String(gdpRow[i]));
    if (!Number.isNaN(y) && targetYears.includes(y) && !Number.isNaN(v) && v > 0) {
      nominal[y] = v / 1000.0;
    }
    const r = parseFloat(String(realRow[i]));
    if (!Number.isNaN(y) && targetYears.includes(y) && !Number.isNaN(r)) {
      realGrowth[y] = round(r - 100, 1);
    }
  }
  return { nominal, realGrowth };
}

interface MonthlyTradePartialResult {
  year: number;
  monthsCount: number;
  label: string;
  totalExports: number;
  totalImports: number;
  tradeBalance: number;
}

/** Extracts current partial-year trade totals (goods + services) from monthly trade workbook when annual workbook does not yet contain it. */
function extractMonthlyPartialYear(wb?: XLSX.WorkBook | null, maxAnnualYear?: number): MonthlyTradePartialResult | null {
  if (!wb || !maxAnnualYear) return null;
  const s11 = wb.Sheets['1.1'];
  const s12 = wb.Sheets['1.2'];
  const s21 = wb.Sheets['2.1'];
  const s22 = wb.Sheets['2.2'];
  if (!s11 || !s12 || !s21 || !s22) return null;

  const r11 = XLSX.utils.sheet_to_json(s11, { header: 1, raw: true, defval: null }) as unknown[][];
  const r12 = XLSX.utils.sheet_to_json(s12, { header: 1, raw: true, defval: null }) as unknown[][];
  const r21 = XLSX.utils.sheet_to_json(s21, { header: 1, raw: true, defval: null }) as unknown[][];
  const r22 = XLSX.utils.sheet_to_json(s22, { header: 1, raw: true, defval: null }) as unknown[][];

  function getYearMonthCols(rowYears: unknown[], rowMonths: unknown[]): Map<number, number[]> {
    const yearCols = new Map<number, number[]>();
    let currentY: number | null = null;
    for (let c = 3; c < rowMonths.length; c++) {
      const yVal = rowYears[c];
      if (yVal != null) {
        const y = parseInt(String(yVal), 10);
        if (!Number.isNaN(y) && y >= 1990 && y <= 2100) {
          currentY = y;
        }
      }
      if (currentY != null && rowMonths[c] != null) {
        const mStr = String(rowMonths[c]).trim();
        if (!mStr.includes('-') && !mStr.includes('%')) {
          if (!yearCols.has(currentY)) yearCols.set(currentY, []);
          yearCols.get(currentY)!.push(c);
        }
      }
    }
    return yearCols;
  }

  const gExpYearCols = getYearMonthCols(r11[4] || [], r11[5] || []);
  const gImpYearCols = getYearMonthCols(r12[4] || [], r12[5] || []);
  const sExpYearCols = getYearMonthCols(r21[4] || [], r21[5] || []);
  const sImpYearCols = getYearMonthCols(r22[4] || [], r22[5] || []);

  const candidateYears = Array.from(gExpYearCols.keys())
    .filter((y) => y > maxAnnualYear)
    .sort((a, b) => a - b);

  if (candidateYears.length === 0) return null;

  const targetYear = candidateYears[candidateYears.length - 1];
  const gExpCols = gExpYearCols.get(targetYear) || [];
  const gImpCols = gImpYearCols.get(targetYear) || [];
  const sExpCols = sExpYearCols.get(targetYear) || [];
  const sImpCols = sImpYearCols.get(targetYear) || [];

  const monthsCount = Math.min(gExpCols.length, gImpCols.length, sExpCols.length, sImpCols.length);
  if (monthsCount === 0) return null;

  const gExp = gExpCols.slice(0, monthsCount).reduce((sum, c) => sum + (Number(r11[6]?.[c]) || 0), 0);
  const gImp = gImpCols.slice(0, monthsCount).reduce((sum, c) => sum + (Number(r12[6]?.[c]) || 0), 0);
  const sExp = sExpCols.slice(0, monthsCount).reduce((sum, c) => sum + (Number(r21[7]?.[c]) || 0), 0);
  const sImp = sImpCols.slice(0, monthsCount).reduce((sum, c) => sum + (Number(r22[7]?.[c]) || 0), 0);

  const totExp = round((gExp + sExp) / 1000.0, 1);
  const totImp = round((gImp + sImp) / 1000.0, 1);
  const tradeBalance = round(totExp - totImp, 1);
  const label = monthsCount < 12 ? `${targetYear} (${monthsCount}m)` : String(targetYear);

  return {
    year: targetYear,
    monthsCount,
    label,
    totalExports: totExp,
    totalImports: totImp,
    tradeBalance,
  };
}

/** Loads Foreign Trade data (goods + services exports and imports) by partner and commodity category from in-memory trade workbook across all available years. */
function loadTradeData(
  tradeWb: XLSX.WorkBook,
  tradeMonthlyWb?: XLSX.WorkBook | null,
): {
  annualYears: number[];
  annualTotalExports: number[];
  annualTotalImports: number[];
  structureYears: number[];
  structureYearLabels: string[];
  structureTotalExports: number[];
  structureTotalImports: number[];
  structureTradeBalance: number[];
  exports: TradePartnerTuple[][];
  imports: TradePartnerTuple[][];
  categoryExports: TradeCategoryTuple[][];
  categoryImports: TradeCategoryTuple[][];
} {
  const expSheet = tradeWb.Sheets['1.10'];
  const impSheet = tradeWb.Sheets['1.11'];
  const expCatSheet = tradeWb.Sheets['1.1 '];
  const impCatSheet = tradeWb.Sheets['1.2'];
  const s31 = tradeWb.Sheets['3.1'];
  const s21 = tradeWb.Sheets['2.1'];
  const s22 = tradeWb.Sheets['2.2'];
  const s23 = tradeWb.Sheets['2.3'];
  const s24 = tradeWb.Sheets['2.4'];

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
      if (!cCode || cCode === 'Others') continue;
      countriesData[cCode] = {};
      for (const y of validYears) {
        const col = yMap.get(y)!;
        countriesData[cCode][y] = (parseFloat(String(rows[r]?.[col])) || 0) / 1000.0;
      }
    }
    return { validYears, totals, countries: countriesData };
  }

  function processItSheet(sheet?: WorkSheet) {
    if (!sheet) return {};
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
    const yMap = new Map<number, number>();
    const headerRow = rows[5] || [];
    for (let col = 3; col < headerRow.length; col++) {
      const val = headerRow[col];
      if (val != null) {
        const num = Number(val);
        if (!Number.isNaN(num) && num >= 1990 && num <= 2100) {
          yMap.set(Math.floor(num), col);
        }
      }
    }

    const countriesData: Record<string, Record<number, number>> = {};
    for (let r = 10; r < rows.length; r++) {
      const rawName = String(rows[r]?.[2] || '').trim();
      if (!rawName || rawName === 'TOTAL' || rawName.startsWith('Note') || rawName.startsWith('Since') || rawName.includes('territories')) continue;
      const cCode = resolveRegionCode(rawName);
      if (!cCode || cCode === 'Others' || cCode === 'Other countries') continue;

      if (!countriesData[cCode]) countriesData[cCode] = {};
      for (const [y, col] of yMap.entries()) {
        const valM = parseFloat(String(rows[r]?.[col])) || 0;
        countriesData[cCode][y] = (countriesData[cCode][y] || 0) + valM / 1000.0;
      }
    }
    return countriesData;
  }

  const expData = processTradeSheet(expSheet);
  const impData = processTradeSheet(impSheet);
  const itExp = processItSheet(s23);
  const itImp = processItSheet(s24);
  const tradeYears = expData.validYears.filter((y) => impData.validYears.includes(y));

  // Extract Total Goods + Services from Sheet 3.1
  const sheet31Exp: Record<number, number> = {};
  const sheet31Imp: Record<number, number> = {};
  if (s31) {
    const rows31 = XLSX.utils.sheet_to_json(s31, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
    let expRow = 7;
    let impRow = 30;
    for (let r = 0; r < rows31.length; r++) {
      const txt = String(rows31[r]?.[0] || rows31[r]?.[2] || '').toLowerCase();
      if (txt.includes('експорт товарів та послуг') || txt.includes('exports of goods and services')) expRow = r;
      if (txt.includes('імпорт товарів та послуг') || txt.includes('imports of goods and services')) impRow = r;
    }
    const h31 = rows31[5] || [];
    for (let col = 3; col < h31.length; col++) {
      const y = parseInt(String(h31[col]), 10);
      if (!Number.isNaN(y) && y >= 1990 && y <= 2100) {
        if (rows31[expRow]?.[col] != null) sheet31Exp[y] = (parseFloat(String(rows31[expRow][col])) || 0) / 1000.0;
        if (rows31[impRow]?.[col] != null) sheet31Imp[y] = (parseFloat(String(rows31[impRow][col])) || 0) / 1000.0;
      }
    }
  }

  // Fallback for 2010 if missing in sheet 3.1: Goods (1.10/1.11) + Services (2.1/2.2)
  const get2010Services = (sheet?: WorkSheet, rowIdx = 8): number => {
    if (!sheet) return 0;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][];
    const h = rows[5] || [];
    for (let c = 0; c < h.length; c++) {
      if (String(h[c]).includes('2010')) return (parseFloat(String(rows[rowIdx]?.[c])) || 0) / 1000.0;
    }
    return 0;
  };
  const servExp2010 = get2010Services(s21, 8);
  const servImp2010 = get2010Services(s22, 8);

  const tExp = tradeYears.map((y) => round(sheet31Exp[y] ?? (expData.totals[y] || 0) + (y === 2010 ? servExp2010 : 0), 1));
  const tImp = tradeYears.map((y) => round(sheet31Imp[y] ?? (impData.totals[y] || 0) + (y === 2010 ? servImp2010 : 0), 1));
  const saldo = tradeYears.map((_, i) => round(tExp[i] - tImp[i], 1));

  // Collect all unique sovereign partner country codes across goods and IT services
  const allCountryCodes = new Set<string>([...Object.keys(expData.countries), ...Object.keys(impData.countries), ...Object.keys(itExp), ...Object.keys(itImp)]);
  allCountryCodes.delete('Others');
  allCountryCodes.delete('Other countries');

  // Per-year breakdowns sorted descending by value: [countryCode, value, share]
  const exports: TradePartnerTuple[][] = [];
  const imports: TradePartnerTuple[][] = [];

  for (let i = 0; i < tradeYears.length; i++) {
    const y = tradeYears[i];
    const totE = tExp[i];
    const totI = tImp[i];

    const yearExp: TradePartnerTuple[] = [];
    for (const code of allCountryCodes) {
      const gVal = expData.countries[code]?.[y] || 0;
      const itVal = itExp[code]?.[y] || 0;
      const roundedVal = round(gVal + itVal, 1);
      if (roundedVal > 0) {
        const share = percentage(roundedVal, totE, 1);
        yearExp.push([code, roundedVal, share]);
      }
    }
    yearExp.sort((a, b) => b[1] - a[1]);
    exports.push(yearExp);

    const yearImp: TradePartnerTuple[] = [];
    for (const code of allCountryCodes) {
      const gVal = impData.countries[code]?.[y] || 0;
      const itVal = itImp[code]?.[y] || 0;
      const roundedVal = round(gVal + itVal, 1);
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
  const s21Rows = s21 ? (XLSX.utils.sheet_to_json(s21, { header: 1, raw: true, blankrows: false, defval: null }) as unknown[][]) : [];
  const s22Rows = s22 ? (XLSX.utils.sheet_to_json(s22, { header: 1, raw: true, blankrows: false, defval: null }) as unknown[][]) : [];

  const catHeaderRow = expCatRows[4] || [];
  const catYearCols = new Map<number, number>();
  for (let c = 3; c < catHeaderRow.length; c++) {
    const y = parseInt(String(catHeaderRow[c]), 10);
    if (!Number.isNaN(y)) catYearCols.set(y, c);
  }

  const s21HeaderRow = s21Rows[5] || [];
  const servYearCols = new Map<number, number>();
  for (let c = 3; c < s21HeaderRow.length; c++) {
    const y = parseInt(String(s21HeaderRow[c]), 10);
    if (!Number.isNaN(y)) servYearCols.set(y, c);
  }

  const COMMODITY_GROUPS: { id: TradeCategoryId; pattern: string }[] = [
    { id: 'agriculture', pattern: 'продовольчі' },
    { id: 'minerals', pattern: 'мінеральні' },
    { id: 'chemicals', pattern: 'хімічної' },
    { id: 'timber', pattern: 'деревина' },
    { id: 'manufactured', pattern: 'промислові' },
    { id: 'metals', pattern: 'метали' },
    { id: 'machinery', pattern: 'машини' },
    { id: 'unclassified_goods', pattern: 'різне' },
  ];

  const resolveCategoryRow = (rows: unknown[][], pattern: string): number => {
    for (let r = 0; r < rows.length; r++) {
      const txt = String(rows[r]?.[0] || rows[r]?.[1] || '').toLowerCase();
      if (txt.includes(pattern)) return r;
    }
    return -1;
  };

  const resolveExactServiceRow = (rows: unknown[][], exactUa: string, patternEn: string): number => {
    for (let r = 0; r < rows.length; r++) {
      const u = String(rows[r]?.[0] || rows[r]?.[1] || '')
        .trim()
        .toLowerCase();
      const e = String(rows[r]?.[2] || '')
        .trim()
        .toLowerCase();
      if (u === exactUa || e === patternEn || u.includes(exactUa)) return r;
    }
    return -1;
  };

  const expTransportRow = resolveExactServiceRow(s21Rows, 'транспорт', 'transport');
  const impTransportRow = resolveExactServiceRow(s22Rows, 'транспорт', 'transport');
  const expTravelRow = resolveExactServiceRow(s21Rows, 'подорожі', 'travel');
  const impTravelRow = resolveExactServiceRow(s22Rows, 'подорожі', 'travel');
  const expItRow = resolveCategoryRow(s21Rows, 'телекомунікаційні, комп');
  const impItRow = resolveCategoryRow(s22Rows, 'телекомунікаційні, комп');
  const expBusinessRow = resolveExactServiceRow(s21Rows, 'інші ділові послуги', 'other business services');
  const impBusinessRow = resolveExactServiceRow(s22Rows, 'інші ділові послуги', 'other business services');

  const COMMODITY_ITEMS: { id: TradeCategoryId; expRow: number; impRow: number }[] = COMMODITY_GROUPS.map(({ id, pattern }) => ({
    id,
    expRow: resolveCategoryRow(expCatRows, pattern),
    impRow: resolveCategoryRow(impCatRows, pattern),
  }));

  const SERVICE_ITEMS: { id: TradeCategoryId; expRow: number; impRow: number }[] = [
    { id: 'it_services', expRow: expItRow, impRow: impItRow },
    { id: 'transport_services', expRow: expTransportRow, impRow: impTransportRow },
    { id: 'travel', expRow: expTravelRow, impRow: impTravelRow },
    { id: 'business_services', expRow: expBusinessRow, impRow: impBusinessRow },
  ];

  // Per-year category breakdowns sorted descending by value: [categoryId, value, share]
  const categoryExports: TradeCategoryTuple[][] = [];
  const categoryImports: TradeCategoryTuple[][] = [];

  for (let i = 0; i < tradeYears.length; i++) {
    const y = tradeYears[i];
    const catCol = catYearCols.get(y);
    const servCol = servYearCols.get(y);
    const totE = tExp[i];
    const totI = tImp[i];

    const yearCatExp: TradeCategoryTuple[] = [];
    const yearCatImp: TradeCategoryTuple[] = [];
    let sumKnownExp = 0;
    let sumKnownImp = 0;

    // 1. 8 Goods categories
    for (const { id, expRow, impRow } of COMMODITY_ITEMS) {
      const expVal = catCol != null && expRow !== -1 ? (Number(expCatRows[expRow]?.[catCol]) || 0) / 1000.0 : 0;
      const impVal = catCol != null && impRow !== -1 ? (Number(impCatRows[impRow]?.[catCol]) || 0) / 1000.0 : 0;
      const roundedExp = round(expVal, 1);
      const roundedImp = round(impVal, 1);

      sumKnownExp += roundedExp;
      sumKnownImp += roundedImp;

      if (roundedExp > 0) {
        const share = percentage(roundedExp, totE, 1);
        yearCatExp.push([id, roundedExp, share]);
      }
      if (roundedImp > 0) {
        const share = percentage(roundedImp, totI, 1);
        yearCatImp.push([id, roundedImp, share]);
      }
    }

    // 2. 4 Service categories
    for (const { id, expRow, impRow } of SERVICE_ITEMS) {
      const expVal = servCol != null && expRow !== -1 ? (Number(s21Rows[expRow]?.[servCol]) || 0) / 1000.0 : 0;
      const impVal = servCol != null && impRow !== -1 ? (Number(s22Rows[impRow]?.[servCol]) || 0) / 1000.0 : 0;
      const roundedExp = round(expVal, 1);
      const roundedImp = round(impVal, 1);

      sumKnownExp += roundedExp;
      sumKnownImp += roundedImp;

      if (roundedExp > 0) {
        const share = percentage(roundedExp, totE, 1);
        yearCatExp.push([id, roundedExp, share]);
      }
      if (roundedImp > 0) {
        const share = percentage(roundedImp, totI, 1);
        yearCatImp.push([id, roundedImp, share]);
      }
    }

    // 3. Residual volume (remaining services + miscellaneous goods) absorbed into category 'other'
    const otherExp = round(Math.max(0, totE - sumKnownExp), 1);
    if (otherExp > 0) {
      const share = percentage(otherExp, totE, 1);
      yearCatExp.push(['other', otherExp, share]);
    }

    const otherImp = round(Math.max(0, totI - sumKnownImp), 1);
    if (otherImp > 0) {
      const share = percentage(otherImp, totI, 1);
      yearCatImp.push(['other', otherImp, share]);
    }

    yearCatExp.sort((a, b) => b[1] - a[1]);
    yearCatImp.sort((a, b) => b[1] - a[1]);

    categoryExports.push(yearCatExp);
    categoryImports.push(yearCatImp);
  }

  const maxAnnualYear = tradeYears[tradeYears.length - 1] ?? 0;
  const partial = extractMonthlyPartialYear(tradeMonthlyWb, maxAnnualYear);

  const structureYears = partial ? [...tradeYears, partial.year] : [...tradeYears];
  const structureYearLabels = partial ? [...tradeYears.map(String), partial.label] : tradeYears.map(String);
  const structureTotalExports = partial ? [...tExp, partial.totalExports] : [...tExp];
  const structureTotalImports = partial ? [...tImp, partial.totalImports] : [...tImp];
  const structureTradeBalance = partial ? [...saldo, partial.tradeBalance] : [...saldo];

  return {
    annualYears: tradeYears,
    annualTotalExports: tExp,
    annualTotalImports: tImp,
    structureYears,
    structureYearLabels,
    structureTotalExports,
    structureTotalImports,
    structureTradeBalance,
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
      const logger = getPipelineLogger('ukraine');
      logger.start('Ukraine');

      await ensurePipelineL1('ukraine');

      const force = forceUpdate || isUpdate();

      let existingCache: UkrainePipelineCache | null = null;
      if (await fileExists(DATA_FILE)) {
        try {
          existingCache = await readJson<UkrainePipelineCache>(DATA_FILE);
        } catch {
          logger.warn('Could not read existing data.json file');
        }
      }

      const hasValidDataset = Boolean(existingCache?.sections?.macro?.years?.length) && Boolean(existingCache?.sections?.['trade-structure']?.years?.length);

      const allUrls = [URL_BUDGET, URL_TRADE, URL_TRADE_M, URL_DEBT_Q, URL_DEBT_Y, URL_GDP];

      // Fast check: verify if remote files are unchanged via HTTP HEAD
      if (!force && hasValidDataset && existingCache?.meta) {
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
          logger.unchanged('NBU ETags match');
          await exportUkraine(existingCache.sections);
          return;
        }

        logger.detected('Downloading updated workbooks');
      }

      let budgetWb: XLSX.WorkBook;
      let tradeWb: XLSX.WorkBook;
      let tradeMonthlyWb: XLSX.WorkBook | null = null;
      let debtWb: XLSX.WorkBook;
      let debtAnnualWb: XLSX.WorkBook | null = null;
      let gdpWb: XLSX.WorkBook;
      const newMeta: Record<string, RemoteFileMeta> = { ...(existingCache?.meta || {}) };

      try {
        const [bRes, tRes, tmRes, dRes, gRes] = await Promise.all([
          fetchBinaryWithMeta(URL_BUDGET),
          fetchBinaryWithMeta(URL_TRADE),
          fetchBinaryWithMeta(URL_TRADE_M).catch(() => null),
          fetchBinaryWithMeta(URL_DEBT_Q),
          fetchBinaryWithMeta(URL_GDP),
        ]);

        newMeta[URL_BUDGET] = bRes.meta;
        newMeta[URL_TRADE] = tRes.meta;
        if (tmRes) {
          newMeta[URL_TRADE_M] = tmRes.meta;
          tradeMonthlyWb = XLSX.read(tmRes.buffer, { type: 'buffer' });
        }
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

      const { ratesByMonth: rates, updatedCache: ratesCache } = await getMonthlyExchangeRates(yearsMonths, existingCache?.rates, force);

      const debtUahByYear = loadDebtData(debtWb, budgetYears, debtAnnualWb);
      const { nominal: gdpUahByYear, realGrowth: realGdpGrowthByYear } = loadGdpData(gdpWb, budgetYears);

      const defenseVals: number[] = [];
      const otherExpVals: number[] = [];
      const totalExpVals: number[] = [];
      const domesticRevVals: number[] = [];
      const grantsVals: number[] = [];
      const loansVals: number[] = [];
      const totalRevFinVals: number[] = [];
      const debtVals: number[] = [];
      const govDebtVals: number[] = [];
      const privDebtVals: number[] = [];
      const gdpList: (number | null)[] = [];
      const realGdpGrowthList: (number | null)[] = [];
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
        const debtObj = debtUahByYear[year] || { total: 0, gov: 0, private: 0 };
        const debtUsd = debtObj.total > 0 ? debtObj.total / rateLastM : 0;
        const govDebtUsd = debtObj.gov > 0 ? debtObj.gov / rateLastM : 0;
        const privDebtUsd = debtObj.private > 0 ? debtObj.private / rateLastM : 0;
        debtVals.push(round(debtUsd, 1));
        govDebtVals.push(round(govDebtUsd, 1));
        privDebtVals.push(round(privDebtUsd, 1));

        const gdpUah = gdpUahByYear[year];
        const gdpUsd = gdpUah != null && weightedRate > 0 ? round(gdpUah / weightedRate, 1) : null;
        gdpList.push(gdpUsd);
        realGdpGrowthList.push(realGdpGrowthByYear[year] ?? null);

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
      const govDebtPct = govDebtVals.map((g, i) => percentage(g, debtVals[i], 1));
      const privDebtPct = privDebtVals.map((p, i) => percentage(p, debtVals[i], 1));

      const trade = loadTradeData(tradeWb, tradeMonthlyWb);

      const macroSectionData: MacroSectionData = {
        years: budgetYears,
        yearLabels,
        rates: weightedRates,
        balances,
        gdp: gdpList,
        realGdpGrowth: realGdpGrowthList,
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
        govDebt: govDebtVals,
        govDebtPct,
        privateDebt: privDebtVals,
        privateDebtPct: privDebtPct,
        debt: debtVals,
      };

      const tradeStructureSectionData: TradeStructureSectionData = {
        years: trade.structureYears,
        yearLabels: trade.structureYearLabels,
        totalExports: trade.structureTotalExports,
        totalImports: trade.structureTotalImports,
        tradeBalance: trade.structureTradeBalance,
      };

      const tradePartnersSectionData: TradePartnersSectionData = {
        years: trade.annualYears,
        totalExports: trade.annualTotalExports,
        totalImports: trade.annualTotalImports,
        exports: trade.exports,
        imports: trade.imports,
      };

      const tradeCategoriesSectionData: TradeCategoriesSectionData = {
        years: trade.annualYears,
        totalExports: trade.annualTotalExports,
        totalImports: trade.annualTotalImports,
        categoryExports: trade.categoryExports,
        categoryImports: trade.categoryImports,
      };

      const macroGrowthSectionData = computeMacroGrowthData(macroSectionData);

      const sections = {
        macro: macroSectionData,
        'macro-growth': macroGrowthSectionData,
        'trade-structure': tradeStructureSectionData,
        'trade-partners': tradePartnersSectionData,
        'trade-categories': tradeCategoriesSectionData,
      };

      await writeJsonAsyncToR2(DATA_FILE, { meta: newMeta, rates: ratesCache, sections });
      await exportUkraine(sections);
      logger.complete(`${budgetYears[0]}–${budgetYears[budgetYears.length - 1]} budget, debt & trade`);
    },
    verbose,
  );
}

if (import.meta.main) {
  runUkrainePipeline(isUpdate(), isVerbose()).catch((err) => {
    getPipelineLogger('ukraine').error('Fatal error running Ukraine pipeline:', err);
    process.exit(1);
  });
}
