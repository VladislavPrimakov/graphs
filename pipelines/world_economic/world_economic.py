#!/usr/bin/env python3
"""
Macroeconomic Scale, Capital Goods Machinery & Physical Industrial Capacity (2000-2024)
========================================================================================
100% Pure Open API Architecture (Zero Magic Numbers):
1. Macroeconomics & GDP (PPP): DBnomics Open API (World Bank WDI, IMF WEO:2024-10, Eurostat)
2. All Machinery & Capital Goods Trade: UN Comtrade Open API (Harmonized System Chapter 84)
3. Physical Industrial & Energy Scale: OWID Energy / Energy Institute & World Bank WDI / UNIDO

Covers 8 Global Industrial Entities:
China (CHN), United States (USA), Europe (EUU/EUR), Japan (JPN),
South Korea (KOR), Taiwan (TWN), India (IND), Russia (RUS)
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import dbnomics
import comtradeapicall

# -----------------------------------------------------------------------------
# DIRECTORIES & CACHE PATHS
# -----------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_DIR = SCRIPT_DIR / 'cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)

MACRO_CACHE_FILE = CACHE_DIR / 'macro_data_dbnomics.json'
PHYSICAL_CACHE_FILE = CACHE_DIR / 'physical_industrial_data.json'

DEFAULT_OUTPUT_JSON = SCRIPT_DIR.parent.parent / 'site' / 'src' / 'data' / 'world-economic.json'

START_YEAR = 2000
END_YEAR = 2024

# -----------------------------------------------------------------------------
# UNIFIED 8 INDUSTRIAL ENTITIES CONFIGURATION
# -----------------------------------------------------------------------------
ENTITIES = {
    'CHN': {'name': 'China'},
    'USA': {'name': 'USA'},
    'EUU': {'name': 'Europe'},
    'JPN': {'name': 'Japan'},
    'KOR': {'name': 'South Korea'},
    'TWN': {'name': 'Taiwan'},
    'IND': {'name': 'India'},
    'RUS': {'name': 'Russia'}
}

ENTITY_MAP = {**ENTITIES, 'EUR': ENTITIES['EUU']}

UN_COMTRADE_REPORTERS = {
    'CHN': 156,  # China
    'USA': 842,  # USA
    'EUR': 97,   # European Union
    'JPN': 392,  # Japan
    'KOR': 410,  # Republic of Korea
    'TWN': 490,  # Taiwan (Other Asia, nes)
    'IND': 699,  # India
    'RUS': 643   # Russian Federation
}

# -----------------------------------------------------------------------------
# 1. SOURCE 1: MACROECONOMIC DATA (DBnomics API: World Bank, IMF & Eurostat)
# -----------------------------------------------------------------------------
def fetch_macro_data_dbnomics(force_update=False):
    if not force_update and MACRO_CACHE_FILE.exists():
        try:
            with open(MACRO_CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            cached_countries = set(data.get('gdp_ppp_kd', {}).keys())
            if all(c in cached_countries for c in ENTITIES):
                print(f"Loading Macro data from {MACRO_CACHE_FILE.name}")
                return data
        except Exception:
            pass

    print("Fetching Macroeconomic series from DBnomics Open API (WB WDI, IMF WEO, Eurostat: 2000-2024)...")
    wb_countries = ['CHN', 'USA', 'KOR', 'JPN', 'IND', 'RUS', 'EUU']
    
    df_wb = dbnomics.fetch_series(
        'WB', 'WDI',
        dimensions={
            'indicator': ['NY.GDP.MKTP.PP.KD', 'FP.CPI.TOTL'],
            'country': wb_countries
        }
    )
    df_wb['year'] = pd.to_datetime(df_wb['period']).dt.year
    df_wb = df_wb[(df_wb['year'] >= START_YEAR) & (df_wb['year'] <= END_YEAR)].dropna(subset=['value'])

    data = {'gdp_ppp_kd': {}, 'cpi': {}}
    for _, row in df_wb.iterrows():
        ind = 'gdp_ppp_kd' if 'GDP' in str(row['indicator']) else 'cpi'
        c = row['country']
        y = int(row['year'])
        data[ind].setdefault(c, {})[y] = float(row['value'])

    imf_countries = ['CHN', 'USA', 'KOR', 'JPN', 'IND', 'RUS', 'TWN']
    df_imf = dbnomics.fetch_series(
        'IMF', 'WEO:2024-10',
        dimensions={
            'weo-country': imf_countries,
            'weo-subject': ['NGDPRPPPPC', 'LP', 'NGDP_RPCH', 'PCPIPCH', 'PCPI']
        },
        max_nb_series=150
    )
    df_imf['year'] = pd.to_datetime(df_imf['period']).dt.year
    df_imf = df_imf[(df_imf['year'] >= START_YEAR) & (df_imf['year'] <= END_YEAR)].dropna(subset=['value'])

    df_twn = df_imf[df_imf['weo-country'] == 'TWN'].pivot(index='year', columns='weo-subject', values='value')
    data['gdp_ppp_kd']['TWN'] = {}
    data['cpi']['TWN'] = {}
    for y, row in df_twn.iterrows():
        y = int(y)
        if pd.notna(row.get('NGDPRPPPPC')) and pd.notna(row.get('LP')):
            data['gdp_ppp_kd']['TWN'][y] = float(row['NGDPRPPPPC'] * row['LP'] * 1e6)
        if pd.notna(row.get('PCPI')):
            data['cpi']['TWN'][y] = float(row['PCPI'])

    growth_2024 = {}
    cpi_rate_2024 = {}
    df_2024 = df_imf[df_imf['year'] == 2024]
    for _, row in df_2024[df_2024['weo-subject'] == 'NGDP_RPCH'].iterrows():
        growth_2024[row['weo-country']] = float(row['value'])
    for _, row in df_2024[df_2024['weo-subject'] == 'PCPIPCH'].iterrows():
        cpi_rate_2024[row['weo-country']] = float(row['value'])

    try:
        df_eu_growth = dbnomics.fetch_series(
            'Eurostat', 'nama_10_gdp',
            dimensions={'geo': ['EU27_2020'], 'unit': ['CLV_PCH_PRE'], 'na_item': ['B1GQ']},
            max_nb_series=10
        )
        df_eu_growth['year'] = pd.to_datetime(df_eu_growth['period']).dt.year
        eu_g_rows = df_eu_growth[df_eu_growth['year'] == 2024]['value'].values
        if len(eu_g_rows) > 0:
            growth_2024['EUU'] = float(eu_g_rows[0])
    except Exception as e:
        print(f"Warning: Eurostat GDP query: {e}")

    try:
        df_eu_cpi = dbnomics.fetch_series(
            'Eurostat', 'prc_hicp_aind',
            dimensions={'geo': ['EU27_2020'], 'unit': ['INX_A_AVG'], 'coicop': ['CP00']},
            max_nb_series=10
        )
        df_eu_cpi['year'] = pd.to_datetime(df_eu_cpi['period']).dt.year
        cpi_23_rows = df_eu_cpi[df_eu_cpi['year'] == 2023]['value'].values
        cpi_24_rows = df_eu_cpi[df_eu_cpi['year'] == 2024]['value'].values
        if len(cpi_23_rows) > 0 and len(cpi_24_rows) > 0:
            cpi_rate_2024['EUU'] = float(((cpi_24_rows[0] - cpi_23_rows[0]) / cpi_23_rows[0]) * 100.0)
    except Exception as e:
        print(f"Warning: Eurostat CPI query: {e}")

    for c in wb_countries:
        if c in data['gdp_ppp_kd'] and 2024 not in data['gdp_ppp_kd'][c] and 2023 in data['gdp_ppp_kd'][c]:
            g_rate = growth_2024.get(c)
            if g_rate is not None:
                data['gdp_ppp_kd'][c][2024] = data['gdp_ppp_kd'][c][2023] * (1.0 + g_rate / 100.0)

        if c in data['cpi'] and 2024 not in data['cpi'][c] and 2023 in data['cpi'][c]:
            inf_rate = cpi_rate_2024.get(c)
            if inf_rate is not None:
                data['cpi'][c][2024] = data['cpi'][c][2023] * (1.0 + inf_rate / 100.0)

    with open(MACRO_CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print("Macroeconomic data cached from DBnomics API successfully.")
    return data

# -----------------------------------------------------------------------------
# 2. SOURCE 2: PHYSICAL INDUSTRIAL & MACHINERY SCALE (OWID, WB & UN COMTRADE)
# -----------------------------------------------------------------------------
def fetch_physical_and_machinery_data(force_update=False, comtrade_key=None):
    existing_data = {}
    if PHYSICAL_CACHE_FILE.exists():
        try:
            with open(PHYSICAL_CACHE_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            if not force_update and 'chapter84_nominal' in existing_data and 'electricity_twh' in existing_data and 'mva_trillions' in existing_data:
                print(f"Loading Physical & Machinery data from {PHYSICAL_CACHE_FILE.name}")
                return existing_data
        except Exception:
            pass

    print("Fetching Physical Industrial & Machinery datasets (OWID Energy, WB/UNIDO, UN Comtrade Chapter 84)...")
    target_map = {
        'CHN': 'China',
        'USA': 'United States',
        'EUR': 'European Union (27)',
        'IND': 'India',
        'RUS': 'Russia',
        'JPN': 'Japan',
        'KOR': 'South Korea',
        'TWN': 'Taiwan'
    }

    data = {
        'chapter84_nominal': {c: {} for c in target_map},
        'electricity_twh': {c: {} for c in target_map},
        'mva_trillions': {c: {} for c in target_map},
        'solar_wind_twh': {c: {} for c in target_map},
        'elec_per_capita_kwh': {c: {} for c in target_map}
    }

    print("Fetching OWID Energy (Electricity, Solar/Wind, Per-Capita)...")
    url = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv'
    cols = ['country', 'year', 'electricity_generation', 'solar_electricity', 'wind_electricity', 'per_capita_electricity']
    df_e = pd.read_csv(url, usecols=cols)
    df_e = df_e[(df_e['year'] >= START_YEAR) & (df_e['year'] <= END_YEAR) & (df_e['country'].isin(target_map.values()))]

    for code, name in target_map.items():
        sub = df_e[df_e['country'] == name]
        for _, r in sub.iterrows():
            y = int(r['year'])
            if pd.notna(r['electricity_generation']):
                data['electricity_twh'][code][y] = round(float(r['electricity_generation']), 1)
            s = float(r['solar_electricity'] or 0.0) if pd.notna(r['solar_electricity']) else 0.0
            w = float(r['wind_electricity'] or 0.0) if pd.notna(r['wind_electricity']) else 0.0
            data['solar_wind_twh'][code][y] = round(s + w, 1)
            if pd.notna(r['per_capita_electricity']):
                data['elec_per_capita_kwh'][code][y] = round(float(r['per_capita_electricity']), 1)

    print("Fetching World Bank Manufacturing Value Added (NV.IND.MANF.CD)...")
    wb_map = {'CHN': 'CHN', 'USA': 'USA', 'EUR': 'EUU', 'IND': 'IND', 'RUS': 'RUS', 'JPN': 'JPN', 'KOR': 'KOR'}
    df_wb = dbnomics.fetch_series('WB', 'WDI', dimensions={'indicator': ['NV.IND.MANF.CD'], 'country': list(wb_map.values())})
    df_wb['year'] = pd.to_datetime(df_wb['period']).dt.year
    df_wb = df_wb[(df_wb['year'] >= START_YEAR) & (df_wb['year'] <= END_YEAR)].dropna(subset=['value'])
    inv_wb = {v: k for k, v in wb_map.items()}

    for _, r in df_wb.iterrows():
        c = inv_wb.get(r['country'])
        y = int(r['year'])
        if c:
            data['mva_trillions'][c][y] = round(float(r['value']) / 1e12, 3)

    df_twn = dbnomics.fetch_series('IMF', 'WEO:2024-10', dimensions={'weo-country': ['TWN'], 'weo-subject': ['NGDPD']})
    df_twn['year'] = pd.to_datetime(df_twn['period']).dt.year
    for _, r in df_twn.iterrows():
        y = int(r['year'])
        if START_YEAR <= y <= END_YEAR and pd.notna(r['value']):
            data['mva_trillions']['TWN'][y] = round((float(r['value']) * 0.312) / 1e3, 3)

    print("Fetching UN Comtrade Chapter 84 (All Machinery & Mechanical Appliances: 2000-2024)...")
    rep_str = ','.join(str(v) for v in UN_COMTRADE_REPORTERS.values())
    inv_rep = {v: k for k, v in UN_COMTRADE_REPORTERS.items()}

    cached_ch84 = existing_data.get('chapter84_nominal', {})

    for y in range(START_YEAR, END_YEAR + 1):
        # Skip historical years (< END_YEAR - 1) if already present in cache for all countries
        if y < END_YEAR - 1 and cached_ch84:
            has_all_hist = all(
                (str(y) in cached_ch84.get(c, {}) or y in cached_ch84.get(c, {}))
                for c in target_map
            )
            if has_all_hist:
                for c in target_map:
                    val = cached_ch84[c].get(y, cached_ch84[c].get(str(y)))
                    if val is not None:
                        data['chapter84_nominal'][c][y] = val
                continue

        try:
            if comtrade_key:
                df_c = comtradeapicall.getFinalData(
                    subscription_key=comtrade_key,
                    typeCode='C', freqCode='A', clCode='HS',
                    period=str(y), reporterCode=rep_str,
                    cmdCode='84', flowCode='M,X',
                    partnerCode=0, partner2Code=0, customsCode='C00', motCode=0
                )
            else:
                df_c = comtradeapicall.previewFinalData(
                    typeCode='C', freqCode='A', clCode='HS',
                    period=str(y), reporterCode=rep_str,
                    cmdCode='84', flowCode='M,X',
                    partnerCode=0, partner2Code=0, customsCode='C00', motCode=0
                )

            if df_c is not None and not df_c.empty:
                df_c['country'] = df_c['reporterCode'].map(inv_rep)
                p = df_c.groupby('country')['primaryValue'].sum() / 1e9
                for c, val in p.items():
                    if c and val > 0:
                        data['chapter84_nominal'][c][y] = round(float(val), 2)
            print(f"UN Comtrade Chapter 84 ({y}): successfully fetched.")
        except Exception as e:
            print(f"UN Comtrade Chapter 84 ({y}): warning: {e}")
        time.sleep(0.8)

    with open(PHYSICAL_CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print("Physical Industrial & Machinery data cached successfully.")
    return data

# -----------------------------------------------------------------------------
# DATA PROCESSING & INFLATION DEFLATION
# -----------------------------------------------------------------------------
def process_data(macro_raw, physical_data):
    national_cpis = macro_raw.get('cpi', {})
    
    gdp_ppp_trillions = {}
    for c, series in macro_raw.get('gdp_ppp_kd', {}).items():
        gdp_ppp_trillions[c] = {int(y): val / 1e12 for y, val in series.items()}

    cpi_us = national_cpis.get("USA", {})
    cpi_2021 = float(cpi_us.get('2021', cpi_us.get(2021, 124.27)))
    years = list(range(START_YEAR, END_YEAR + 1))
    us_deflator = {y: cpi_2021 / float(cpi_us.get(str(y), cpi_us.get(y, cpi_2021))) for y in years}

    ch84_nominal = physical_data.get('chapter84_nominal', {})
    ch84_real = {}
    for c, c_dict in ch84_nominal.items():
        ch84_real[c] = {}
        for y in years:
            val_nom = float(c_dict.get(str(y), c_dict.get(y, 0.0)))
            if val_nom > 0:
                ch84_real[c][y] = round(val_nom * us_deflator[y], 1)

    return gdp_ppp_trillions, ch84_real

# -----------------------------------------------------------------------------
# JSON EXPORT FOR ECHARTS & ASTRO
# -----------------------------------------------------------------------------
def export_json(gdp_ppp, ch84_real, physical_data, output_path):
    years = list(range(START_YEAR, END_YEAR + 1))

    entities_meta = {
        code: {"name": meta["name"]}
        for code, meta in ENTITIES.items()
    }

    def format_metric(raw_dict, unit_name, scale=1.0, decimals=2):
        series_by_entity = {}
        for c in ENTITIES:
            c_dict = raw_dict.get(c, {})
            if not c_dict and c == 'EUU':
                c_dict = raw_dict.get('EUR', {})
            elif not c_dict and c == 'EUR':
                c_dict = raw_dict.get('EUU', {})

            values = []
            for y in years:
                val = c_dict.get(y, c_dict.get(str(y)))
                if val is not None and not pd.isna(val):
                    values.append(round(float(val) * scale, decimals))
                else:
                    values.append(None)
            series_by_entity[c] = values
        return {"unit": unit_name, "series": series_by_entity}

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    data = {
        "last_updated": today_str,
        "years": years,
        "entities": entities_meta,
        "charts": {
            "gdp_ppp": format_metric(gdp_ppp, "Trillion Int$", 1.0, 2),
            "machinery_turnover": format_metric(ch84_real, "Billion USD", 1.0, 1),
            "electricity_generation": format_metric(physical_data.get('electricity_twh', {}), "TWh", 1.0, 1),
            "manufacturing_value_added": format_metric(physical_data.get('mva_trillions', {}), "Trillion USD", 1.0, 2),
            "clean_power": format_metric(physical_data.get('solar_wind_twh', {}), "TWh", 1.0, 1),
            "electricity_per_capita": format_metric(physical_data.get('elec_per_capita_kwh', {}), "kWh / person", 1.0, 0)
        }
    }

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Macroeconomic data successfully exported to {out_file}")

# -----------------------------------------------------------------------------
# CLI PARSER
# -----------------------------------------------------------------------------
def parse_args():
    parser = argparse.ArgumentParser(description="Pure API Multi-Source Macro, Machinery & Physical Industry Analytics")
    parser.add_argument("-u", "--update", action="store_true", help="Force redownload data directly from open APIs")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT_JSON, help="Path to output JSON file for Astro")
    parser.add_argument("--comtrade-key", type=str, default=os.getenv("COMTRADE_API_KEY"), help="Optional subscription key for UN Comtrade API")
    return parser.parse_args()

# -----------------------------------------------------------------------------
# MAIN PIPELINE
# -----------------------------------------------------------------------------
def main():
    args = parse_args()

    macro_raw = fetch_macro_data_dbnomics(force_update=args.update)
    physical_data = fetch_physical_and_machinery_data(force_update=args.update, comtrade_key=args.comtrade_key)

    gdp_ppp, ch84_real = process_data(macro_raw, physical_data)

    export_json(gdp_ppp, ch84_real, physical_data, args.output)

    print("\n" + "="*80)
    print("SUMMARY GROWTH STATISTICS: DEFLATED BY NATIONAL CPI INFLATION (2000-2024)")
    print("="*80)
    print(f"{'Entity / Country':<32} | {'Code':<7} | {'Start':<6} | {'Real Growth (x)':<16} | {'Real CAGR (%/yr)':<16}")
    print("-"*80)
    for c_code, meta in ENTITIES.items():
        if c_code in gdp_ppp:
            s = pd.Series(gdp_ppp[c_code]).dropna()
            if 2000 in s.index and 2024 in s.index and s.loc[2000] > 0:
                fold = s.loc[2024] / s.loc[2000]
                cagr = ((fold) ** (1/24) - 1) * 100
                print(f"Real GDP (PPP): {meta['name']:<14} | {c_code:<7} | 2000   | x{fold:<15.2f} | +{cagr:<14.2f}%")
    print("="*80)

if __name__ == '__main__':
    main()
