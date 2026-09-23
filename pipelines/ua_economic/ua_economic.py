"""
Ukraine Budget, External Debt and Foreign Trade Analysis (ETL Pipeline).
Sources:
- National Bank of Ukraine (NBU) Open Data Portal:
  * Budget execution (C_budget_m.xlsx)
  * External trade structure (Trade_y.xlsx)
  * Gross external debt (ZB_q_UAH.xlsx)
  * Nominal GDP (GDP_y.xlsx)
- NBU Exchange Rates API:
  * Official daily/monthly USD/UAH weighted exchange rates.
"""

import os
import sys
import argparse
import urllib.request
import json
import time
from datetime import datetime, timezone
import pandas as pd
import numpy as np

# -----------------------------------------------------------------------------
# CONFIGURATION & CONSTANTS
# -----------------------------------------------------------------------------
START_YEAR = 2022
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if '__file__' in locals() else '.'
CACHE_DIR = os.path.join(SCRIPT_DIR, 'cache')
BUDGET_FILE = os.path.join(CACHE_DIR, 'C_budget_m.xlsx')
TRADE_FILE = os.path.join(CACHE_DIR, 'Trade_y.xlsx')
DEBT_FILE = os.path.join(CACHE_DIR, 'ZB_q_UAH.xlsx')
GDP_FILE = os.path.join(CACHE_DIR, 'GDP_y.xlsx')
RATES_CACHE_FILE = os.path.join(CACHE_DIR, 'usd_rates.json')
META_CACHE_FILE = os.path.join(CACHE_DIR, 'headers_meta.json')

DEFAULT_OUTPUT_JSON = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', 'site', 'src', 'data', 'ua-economic.json'))

URL_BUDGET = 'https://bank.gov.ua/files/macro/C_budget_m.xlsx'
URL_TRADE = 'https://bank.gov.ua/files/ES/Trade_y.xlsx'
URL_DEBT = 'https://bank.gov.ua/files/ES/ZB_q_UAH.xlsx'
URL_GDP = 'https://bank.gov.ua/files/macro/GDP_y.xlsx'

# -----------------------------------------------------------------------------
# DOWNLOAD & CACHE UTILITIES
# -----------------------------------------------------------------------------
def download_file(url: str, filepath: str) -> None:
    """Download source file from NBU directly to cache."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())
        print(f"Downloaded latest {os.path.basename(filepath)}.")
    except Exception as e:
        print(f"Warning/Error downloading {url}: {e}")
        if os.path.exists(filepath):
            print(f"Using existing cached file {filepath}")
        else:
            raise

def ensure_data_files(force_update: bool = False) -> None:
    """Download all required Excel files directly to cache/ if force_update or missing."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    files_to_check = [
        (URL_BUDGET, BUDGET_FILE),
        (URL_TRADE, TRADE_FILE),
        (URL_DEBT, DEBT_FILE),
        (URL_GDP, GDP_FILE)
    ]
    for url, path in files_to_check:
        if force_update or not os.path.exists(path):
            download_file(url, path)
        else:
            print(f"Using cached file: {os.path.basename(path)}")

def get_monthly_exchange_rates(years_months: dict, force_update: bool = False) -> dict:
    """
    Fetch official monthly average USD/UAH exchange rates from the NBU API.
    Caches results locally to avoid unnecessary network queries.
    """
    rates_by_month = {}
    cache = {}
    if os.path.exists(RATES_CACHE_FILE):
        try:
            with open(RATES_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
        except Exception as e:
            print(f"Warning: could not read exchange rates cache: {e}")

    cache_modified = False
    for year in sorted(years_months.keys()):
        year_str = str(year)
        required_months = years_months[year]
        has_all_months = (year_str in cache) and all(str(m) in cache[year_str] for m in required_months)

        if not force_update and has_all_months:
            for m in required_months:
                rates_by_month[(year, m)] = cache[year_str][str(m)]
        else:
            url = f"https://bank.gov.ua/NBU_Exchange/exchange_site?start={year}0101&end={year}1231&valcode=usd&sort=exchangedate&order=asc&json"
            print(f"Fetching USD/UAH rates for {year} from NBU API...")
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=20) as r:
                    data = json.loads(r.read().decode('utf-8'))

                month_vals = {}
                for item in data:
                    date_str = item.get('exchangedate')
                    rate = item.get('rate')
                    if date_str and rate is not None:
                        parts = date_str.split('.')
                        if len(parts) == 3:
                            m = int(parts[1])
                            month_vals.setdefault(m, []).append(rate)

                year_rates = cache.get(year_str, {})
                for m, vals in month_vals.items():
                    avg_rate = sum(vals) / len(vals)
                    rates_by_month[(year, m)] = avg_rate
                    year_rates[str(m)] = avg_rate

                cache[year_str] = year_rates
                cache_modified = True
            except Exception as e:
                print(f"Warning: Failed to fetch online rates for {year}: {e}")
                if year_str in cache:
                    print(f"Falling back to existing cache for {year}")
                    for m in required_months:
                        rates_by_month[(year, m)] = cache[year_str].get(str(m), 40.0)
                else:
                    raise

    if cache_modified:
        try:
            with open(RATES_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(cache, f, indent=4)
        except Exception as e:
            print(f"Error saving exchange rate cache: {e}")

    return rates_by_month

# -----------------------------------------------------------------------------
# HIGH PERFORMANCE EXCEL PARSING
# -----------------------------------------------------------------------------
def build_date_to_column_map(df: pd.DataFrame) -> dict:
    """
    Scans row 1 of the budget sheet once in O(cols) time and returns
    a mapping from (year, month) to column index.
    """
    date_to_col = {}
    for col in range(2, df.shape[1]):
        val = df.iloc[1, col]
        if pd.notna(val):
            if hasattr(val, 'year') and hasattr(val, 'month'):
                date_to_col[(val.year, val.month)] = col
            else:
                try:
                    dt = pd.to_datetime(val)
                    date_to_col[(dt.year, dt.month)] = col
                except Exception:
                    pass
    return date_to_col

def extract_monthly_differences(df: pd.DataFrame, row_idx: int, year: int, months: list, date_to_col: dict) -> dict:
    """
    NBU budget files report values cumulatively (year-to-date) in millions of UAH.
    Converts cumulative values into discrete monthly incremental differences.
    """
    cols = [date_to_col.get((year, m)) for m in months]
    raw_vals = [float(df.iloc[row_idx, c]) if c is not None and pd.notna(df.iloc[row_idx, c]) else 0.0 for c in cols]
    s = pd.Series(raw_vals, dtype=float)
    deltas = s.diff().fillna(s.iloc[0]).tolist()
    return dict(zip(months, deltas))

def load_debt_data(filepath: str, target_years: list) -> dict:
    """
    Parses sheet '1.1' of ZB_q_UAH.xlsx to extract Total Gross External Debt
    in billions of UAH for the latest available period of each year.
    """
    with pd.ExcelFile(filepath) as xl:
        df = pd.read_excel(xl, sheet_name='1.1', header=None)

    debt_row = 95
    for r in range(df.shape[0]):
        txt = str(df.iloc[r, 0]).strip().lower()
        if 'разом' in txt and 'всього' in txt:
            debt_row = r
            break

    col_years = []
    current_year = None
    for c in range(2, df.shape[1]):
        val = df.iloc[4, c]
        if pd.notna(val):
            try:
                current_year = int(float(val))
            except Exception:
                pass
        col_years.append(current_year)

    year_latest_col = {}
    for idx, y in enumerate(col_years):
        if y is not None:
            year_latest_col[y] = idx + 2

    debt_by_year_uah_b = {}
    for y in target_years:
        if y in year_latest_col:
            col = year_latest_col[y]
            val_uah_m = df.iloc[debt_row, col]
            debt_by_year_uah_b[y] = (float(val_uah_m) / 1000.0) if pd.notna(val_uah_m) else 0.0
        else:
            debt_by_year_uah_b[y] = 0.0

    return debt_by_year_uah_b

def load_gdp_data(filepath: str, target_years: list) -> dict:
    """
    Parses sheet 'GDP_1996-2025' from GDP_y.xlsx to extract official Nominal GDP
    in billions of UAH strictly from table data.
    """
    with pd.ExcelFile(filepath) as xl:
        df = pd.read_excel(xl, sheet_name='GDP_1996-2025', header=None)

    years_row = list(df.iloc[1, 2:])
    gdp_row = list(df.iloc[4, 2:])

    gdp_uah_b = {}
    for y, v in zip(years_row, gdp_row):
        try:
            y_int = int(y)
            if y_int in target_years and pd.notna(v) and float(v) > 0:
                gdp_uah_b[y_int] = float(v) / 1000.0
        except Exception:
            pass

    return gdp_uah_b

def load_budget_and_debt(start_year: int = START_YEAR, force_update: bool = False) -> tuple:
    """
    Parses budget revenues, expenditures, and financing from C_budget_m.xlsx,
    converts to USD via dynamic NBU rates, and integrates external debt and GDP.
    """
    with pd.ExcelFile(BUDGET_FILE) as xl:
        df_rev = pd.read_excel(xl, sheet_name='1', header=None)
        df_exp = pd.read_excel(xl, sheet_name='4', header=None)
        df_fin = pd.read_excel(xl, sheet_name='7', header=None)

    date_to_col = build_date_to_column_map(df_rev)

    years_months = {}
    for (y, m), col in sorted(date_to_col.items()):
        if y >= start_year:
            rev_val = df_rev.iloc[2, col]
            if pd.notna(rev_val) and rev_val != 0:
                years_months.setdefault(y, []).append(m)

    budget_years = sorted(list(years_months.keys()))
    rates = get_monthly_exchange_rates(years_months, force_update=force_update)
    debt_uah_by_year = load_debt_data(DEBT_FILE, budget_years)
    gdp_uah_by_year = load_gdp_data(GDP_FILE, budget_years)

    budget_list = []
    finance_list = []

    for year in budget_years:
        months = years_months[year]

        def_m = extract_monthly_differences(df_exp, 3, year, months, date_to_col)
        tot_exp_m = extract_monthly_differences(df_exp, 14, year, months, date_to_col)

        tot_rev_m = extract_monthly_differences(df_rev, 2, year, months, date_to_col)
        grants_m = extract_monthly_differences(df_rev, 31, year, months, date_to_col)
        trust_m = extract_monthly_differences(df_rev, 32, year, months, date_to_col)

        ext_loan_m = extract_monthly_differences(df_fin, 11, year, months, date_to_col)

        def_usd_sum = 0.0
        others_usd_sum = 0.0
        tot_exp_usd_sum = 0.0
        tot_exp_uah_sum = 0.0

        int_rev_usd_sum = 0.0
        grants_usd_sum = 0.0
        trust_usd_sum = 0.0
        loan_usd_sum = 0.0

        for m in months:
            rate = rates[(year, m)]

            def_uah = def_m[m]
            tot_exp_uah = tot_exp_m[m]
            others_uah = tot_exp_uah - def_uah

            def_usd = (def_uah / 1000.0) / rate
            others_usd = (others_uah / 1000.0) / rate
            tot_exp_usd = (tot_exp_uah / 1000.0) / rate

            def_usd_sum += def_usd
            others_usd_sum += others_usd
            tot_exp_usd_sum += tot_exp_usd
            tot_exp_uah_sum += tot_exp_uah / 1000.0

            tot_rev_uah = tot_rev_m[m]
            grants_uah = grants_m[m]
            trust_uah = trust_m[m]
            int_rev_uah = tot_rev_uah - grants_uah - trust_uah
            ext_loan_uah = ext_loan_m[m]

            int_rev_usd_sum += (int_rev_uah / 1000.0) / rate
            grants_usd_sum += (grants_uah / 1000.0) / rate
            trust_usd_sum += (trust_uah / 1000.0) / rate
            loan_usd_sum += (ext_loan_uah / 1000.0) / rate

        weighted_rate = round(tot_exp_uah_sum / tot_exp_usd_sum, 2) if tot_exp_usd_sum > 0 else 0.0
        label_year = f"{year} ({len(months)} months)" if len(months) < 12 else str(year)

        last_m = months[-1]
        rate_last_m = rates[(year, last_m)]
        debt_uah = debt_uah_by_year.get(year, 0.0)
        debt_usd = debt_uah / rate_last_m

        gdp_uah = gdp_uah_by_year.get(year)
        gdp_usd = (gdp_uah / weighted_rate) if (gdp_uah is not None and weighted_rate > 0) else np.nan

        budget_list.append({
            'Year': year,
            'Rate': weighted_rate,
            'Year_Label': label_year,
            'Defense_USD': def_usd_sum,
            'Other_USD': others_usd_sum,
            'Total_USD': tot_exp_usd_sum,
            'Debt_USD': debt_usd,
            'GDP_USD': gdp_usd
        })

        non_loan_usd = grants_usd_sum + trust_usd_sum
        finance_list.append({
            'Year': year,
            'Rate': weighted_rate,
            'Year_Label': label_year,
            'Domestic_USD': int_rev_usd_sum,
            'Grants_USD': non_loan_usd,
            'Loans_USD': loan_usd_sum,
            'External_Total_USD': non_loan_usd + loan_usd_sum,
            'Total_USD': int_rev_usd_sum + non_loan_usd + loan_usd_sum
        })

    return pd.DataFrame(budget_list), pd.DataFrame(finance_list), budget_years

def load_trade_data(budget_years: list) -> tuple:
    """
    Parses sheets '1.10' (Exports) and '1.11' (Imports) from Trade_y.xlsx.
    Determines top 5 export and top 5 import partners, computes 'Others' and trade balance.
    """
    with pd.ExcelFile(TRADE_FILE) as xl:
        df_exp = pd.read_excel(xl, sheet_name='1.10', header=None)
        df_imp = pd.read_excel(xl, sheet_name='1.11', header=None)

    def process_sheet(df):
        y_map = {}
        for col in range(7, df.shape[1]):
            val = df.iloc[5, col]
            try:
                y = int(float(val))
                y_map[y] = col
            except Exception:
                break

        valid_years = [y for y in budget_years if y in y_map]
        totals = {y: float(df.iloc[6, y_map[y]]) / 1000.0 for y in valid_years}

        countries = {}
        for r in range(7, 43):
            name = df.iloc[r, 5]
            if pd.isna(name) or name == 'TOTAL':
                continue
            countries[name] = {y: float(df.iloc[r, y_map[y]]) / 1000.0 for y in valid_years}
        return valid_years, totals, countries

    years_exp, tot_exp, c_exp = process_sheet(df_exp)
    years_imp, tot_imp, c_imp = process_sheet(df_imp)
    trade_years = [y for y in years_exp if y in years_imp]

    stats_exp = {c: sum(vals.get(y, 0) for y in trade_years) for c, vals in c_exp.items()}
    stats_imp = {c: sum(vals.get(y, 0) for y in trade_years) for c, vals in c_imp.items()}

    top_exp_c = [c for c, _ in sorted(stats_exp.items(), key=lambda x: x[1], reverse=True)[:5]]
    top_imp_c = [c for c, _ in sorted(stats_imp.items(), key=lambda x: x[1], reverse=True)[:5]]

    unique_partners = list(dict.fromkeys(top_exp_c + top_imp_c))

    exp_data = {c: [c_exp.get(c, {}).get(y, 0.0) for y in trade_years] for c in top_exp_c}
    imp_data = {c: [c_imp.get(c, {}).get(y, 0.0) for y in trade_years] for c in top_imp_c}

    exp_data['Others'] = [tot_exp.get(y, 0.0) - sum(c_exp.get(c, {}).get(y, 0.0) for c in top_exp_c) for y in trade_years]
    imp_data['Others'] = [tot_imp.get(y, 0.0) - sum(c_imp.get(c, {}).get(y, 0.0) for c in top_imp_c) for y in trade_years]

    t_exp = [tot_exp.get(y, 0.0) for y in trade_years]
    t_imp = [tot_imp.get(y, 0.0) for y in trade_years]
    saldo = [e - i for e, i in zip(t_exp, t_imp)]

    return trade_years, t_exp, t_imp, saldo, unique_partners, top_exp_c, top_imp_c, exp_data, imp_data

# -----------------------------------------------------------------------------
# JSON EXPORT FOR ECHARTS & ASTRO
# -----------------------------------------------------------------------------
def export_json(df_expenses: pd.DataFrame, df_financing: pd.DataFrame, trade_data: tuple, output_path: str, files_updated: bool = True):
    trade_years, t_exp, t_imp, saldo, unique_partners, top_exp_c, top_imp_c, exp_data, imp_data = trade_data

    budget_years = df_expenses['Year'].tolist()
    year_labels = [y.replace('\n', ' ') for y in df_expenses['Year_Label'].tolist()]
    rates = [round(float(r), 2) for r in df_expenses['Rate'].tolist()]

    balances = [round(float(r + g - e), 2) for r, g, e in zip(
        df_financing['Domestic_USD'], df_financing['Grants_USD'], df_expenses['Total_USD']
    )]

    exp_pct = []
    rev_pct = []
    debt_pct = []
    gdp_list = []

    for i in range(len(df_expenses)):
        gdp_val = df_expenses['GDP_USD'].iloc[i]
        tot_exp = df_expenses['Total_USD'].iloc[i]
        tot_rev = df_financing['Total_USD'].iloc[i]
        debt = df_expenses['Debt_USD'].iloc[i]

        if pd.notna(gdp_val) and gdp_val > 0:
            gdp_list.append(round(float(gdp_val), 1))
            exp_pct.append(round(float((tot_exp / gdp_val) * 100.0), 0))
            rev_pct.append(round(float((tot_rev / gdp_val) * 100.0), 0))
            debt_pct.append(round(float((debt / gdp_val) * 100.0), 0))
        else:
            gdp_list.append(None)
            exp_pct.append(None)
            rev_pct.append(None)
            debt_pct.append(None)

    defense_vals = [round(float(x), 1) for x in df_expenses['Defense_USD'].tolist()]
    other_exp_vals = [round(float(x), 1) for x in df_expenses['Other_USD'].tolist()]
    total_exp_vals = [round(float(x), 1) for x in df_expenses['Total_USD'].tolist()]
    domestic_rev_vals = [round(float(x), 1) for x in df_financing['Domestic_USD'].tolist()]
    grants_vals = [round(float(x), 1) for x in df_financing['Grants_USD'].tolist()]
    loans_vals = [round(float(x), 1) for x in df_financing['Loans_USD'].tolist()]
    total_rev_fin_vals = [round(float(x), 1) for x in df_financing['Total_USD'].tolist()]
    debt_vals = [round(float(x), 1) for x in df_expenses['Debt_USD'].tolist()]

    defense_pct = [round((d / t) * 100) if t > 0 else 0 for d, t in zip(defense_vals, total_exp_vals)]
    other_exp_pct = [round((o / t) * 100) if t > 0 else 0 for o, t in zip(other_exp_vals, total_exp_vals)]
    domestic_rev_pct = [round((r / t) * 100) if t > 0 else 0 for r, t in zip(domestic_rev_vals, total_rev_fin_vals)]
    grants_pct = [round((g / t) * 100) if t > 0 else 0 for g, t in zip(grants_vals, total_rev_fin_vals)]
    loans_pct = [round((l / t) * 100) if t > 0 else 0 for l, t in zip(loans_vals, total_rev_fin_vals)]

    all_partners = unique_partners + (['Others'] if 'Others' not in unique_partners else [])
    exports_breakdown = []
    imports_breakdown = []
    for i in range(len(trade_years)):
        tot_e = float(t_exp[i])
        tot_i = float(t_imp[i])

        year_exp = []
        for p in all_partners:
            v = round(float(exp_data.get(p, [0.0]*len(trade_years))[i]), 1)
            if v > 0:
                pct = round((v / tot_e) * 100) if tot_e > 0 else 0
                year_exp.append({"name": p, "value": v, "pct": pct})
        year_exp.sort(key=lambda x: x["value"], reverse=True)
        exports_breakdown.append(year_exp)

        year_imp = []
        for p in all_partners:
            v = round(float(imp_data.get(p, [0.0]*len(trade_years))[i]), 1)
            if v > 0:
                pct = round((v / tot_i) * 100) if tot_i > 0 else 0
                year_imp.append({"name": p, "value": v, "pct": pct})
        year_imp.sort(key=lambda x: x["value"], reverse=True)
        imports_breakdown.append(year_imp)

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data = {
        "last_updated": today_str,
        "budget_debt": {
            "years": budget_years,
            "year_labels": year_labels,
            "rates": rates,
            "balances": balances,
            "gdp": gdp_list,
            "exp_gdp_pct": exp_pct,
            "rev_gdp_pct": rev_pct,
            "debt_gdp_pct": debt_pct,
            "defense": defense_vals,
            "defense_pct": defense_pct,
            "other_exp": other_exp_vals,
            "other_exp_pct": other_exp_pct,
            "total_exp": total_exp_vals,
            "domestic_rev": domestic_rev_vals,
            "domestic_rev_pct": domestic_rev_pct,
            "grants": grants_vals,
            "grants_pct": grants_pct,
            "loans": loans_vals,
            "loans_pct": loans_pct,
            "total_rev_fin": total_rev_fin_vals,
            "debt": debt_vals
        },
        "trade": {
            "years": trade_years,
            "total_exports": [round(float(x), 1) for x in t_exp],
            "total_imports": [round(float(x), 1) for x in t_imp],
            "trade_balance": [round(float(x), 1) for x in saldo],
            "partners": all_partners,
            "exports_breakdown": exports_breakdown,
            "imports_breakdown": imports_breakdown,
            "exports_by_partner": {
                p: [round(float(exp_data.get(p, [0.0]*len(trade_years))[i]), 1) for i in range(len(trade_years))]
                for p in all_partners
            },
            "imports_by_partner": {
                p: [round(float(imp_data.get(p, [0.0]*len(trade_years))[i]), 1) for i in range(len(trade_years))]
                for p in all_partners
            }
        }
    }

    out_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(out_dir, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Data successfully exported to {output_path}")

# -----------------------------------------------------------------------------
# MAIN CLI PIPELINE
# -----------------------------------------------------------------------------
def parse_arguments():
    parser = argparse.ArgumentParser(description="Analyze Ukraine budget, debt, and foreign trade with NBU open data.")
    parser.add_argument("-u", "--update", action="store_true",
                        help="Force re-download of latest data files from NBU and refresh rates cache.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT_JSON,
                        help="Path to output JSON file for Astro site.")
    return parser.parse_args()

def main():
    args = parse_arguments()
    start_time = time.time()

    files_updated = ensure_data_files(force_update=args.update)

    print("Processing budget and external debt data...")
    df_expenses, df_financing, budget_years = load_budget_and_debt(start_year=START_YEAR, force_update=args.update)

    print("Processing foreign trade data...")
    trade_data = load_trade_data(budget_years)

    print(f"Exporting data to JSON...")
    export_json(df_expenses, df_financing, trade_data, args.output, files_updated=files_updated)

    elapsed = time.time() - start_time
    print(f"All operations completed in {elapsed:.2f} seconds.")

if __name__ == '__main__':
    main()
