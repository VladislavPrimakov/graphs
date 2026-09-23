import os
import sys
import json
import time
from datetime import datetime, timezone
import requests
import pandas as pd

# Setup directories
script_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in locals() else '.'
cache_dir = os.path.join(script_dir, 'cache')
os.makedirs(cache_dir, exist_ok=True)

base_file = os.path.join(cache_dir, 'launches_base.json')
default_output_json = os.path.abspath(os.path.join(script_dir, '..', '..', 'site', 'src', 'data', 'space-launches.json'))

# API configuration
api_host = "ll.thespacedevs.com"
api_version = "2.3.0"

# Country to region mapping
COUNTRY_REGION_MAP = {
    'RUS': 'Russia', 'KAZ': 'Russia', 'SUN': 'Russia', 'RUSSIA': 'Russia',
    'USA': 'USA', 'UNITED STATES': 'USA',
    'CHN': 'China', 'CHINA': 'China',
    'JPN': 'Japan', 'JAPAN': 'Japan',
    'IND': 'India', 'INDIA': 'India',
    'EUROPE': 'Europe', 'OTHERS': 'Others'
}
EUROPE_CODES = {'FRA', 'GUF', 'ESA', 'PRT', 'ESP', 'ITA', 'DEU', 'SWE', 'NOR', 'GBR', 'NLD', 'BEL'}

def map_country(code: str) -> str:
    if not code:
        return 'Others'
    code_clean = str(code).upper().strip()
    if code_clean in COUNTRY_REGION_MAP:
        return COUNTRY_REGION_MAP[code_clean]
    if code_clean in EUROPE_CODES:
        return 'Europe'
    return 'Others'

# 1. Load base launches data
launches_by_id = {}

if os.path.exists(base_file):
    try:
        with open(base_file, "r", encoding="utf-8") as f:
            for item in json.load(f):
                if isinstance(item, dict) and "id" in item:
                    launches_by_id[item["id"]] = item
        print(f"Loaded {len(launches_by_id)} base launches from {os.path.basename(base_file)}.")
    except Exception as e:
        print(f"Error loading {base_file}: {e}")

# Fallback: if base_file didn't load, try chunk/consolidated files in cache
if not launches_by_id:
    consolidated_cache = os.path.join(cache_dir, "launches_all_consolidated.json")
    raw_list = []
    if os.path.exists(consolidated_cache):
        try:
            with open(consolidated_cache, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
        except Exception:
            pass
    for item in raw_list:
        if isinstance(item, dict) and "id" in item:
            launches_by_id[item["id"]] = item

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

force_update = "-u" in sys.argv or "--update" in sys.argv

# 2. Fetch the latest page (100 recent launches) if force_update or cache missing
latest_cache_file = os.path.join(cache_dir, "latest_100.json")
new_launches_fetched = []

if force_update or not os.path.exists(latest_cache_file):
    try:
        print(f"Fetching latest 100 launches from Space Devs API (previous launches)...")
        url = f"https://{api_host}/{api_version}/launches/previous/?limit=100&mode=detailed"
        resp = requests.get(url, headers=headers, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            new_launches_fetched = data.get("results", [])
            try:
                with open(latest_cache_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
        elif resp.status_code == 429:
            print("Space Devs API rate limit reached (HTTP 429). Using existing cache.")
        else:
            print(f"Space Devs API returned HTTP {resp.status_code}. Using existing cache.")
    except Exception as e:
        print(f"Network error querying Space Devs API: {e}. Using existing cache.")
else:
    print(f"Using cached latest launches from {os.path.basename(latest_cache_file)}")

if not new_launches_fetched and os.path.exists(latest_cache_file):
    try:
        with open(latest_cache_file, "r", encoding="utf-8") as f:
            new_launches_fetched = json.load(f).get("results", [])
    except Exception:
        pass

# 3. Parse and merge recent launches into launches_by_id
added_count = 0
for launch in new_launches_fetched:
    # Only successful launches (status 3: Success)
    if (launch.get("status") or {}).get("id") != 3:
        continue
    net = launch.get("net")
    if not net:
        continue
    try:
        launch_year = int(net.split("-")[0])
    except:
        continue

    rc = launch.get("rocket") or {}
    config = rc.get("configuration") or {}

    payload_kg = 0.0
    leo_cap = config.get("leo_capacity")
    if leo_cap is not None:
        try:
            payload_kg = float(leo_cap)
        except:
            pass

    if payload_kg == 0.0:
        sso_cap = config.get("sso_capacity")
        if sso_cap is not None:
            try:
                payload_kg = float(sso_cap)
            except:
                pass

    if payload_kg == 0.0:
        continue

    launch_cost = config.get("launch_cost")
    pad = launch.get("pad") or {}
    location = pad.get("location") or {}
    country_obj = location.get("country") or pad.get("country")
    country_code = country_obj.get("alpha_3_code") if country_obj else ""
    if not country_code:
        lsp = launch.get("launch_service_provider") or {}
        country_code = lsp.get("country_code", "")

    lid = launch.get("id")
    if lid not in launches_by_id:
        added_count += 1

    launches_by_id[lid] = {
        "id": lid,
        "year": launch_year,
        "net": net[:10],
        "leo_kg": payload_kg,
        "cost": float(launch_cost) if launch_cost is not None else None,
        "country": country_code
    }

print(f"Merged recent launches: {added_count} new additions. Total records: {len(launches_by_id)}")

# Save updated launches_base.json if we are running in the repo
if added_count > 0 and os.path.exists(base_file):
    try:
        all_sorted = sorted(launches_by_id.values(), key=lambda x: (x.get("year", 0), x.get("net", "")))
        with open(base_file, "w", encoding="utf-8") as f:
            json.dump(all_sorted, f, ensure_ascii=False, separators=(',', ':'))
        print(f"Updated base archive {base_file} ({len(all_sorted)} launches).")
    except Exception as e:
        print(f"Could not rewrite base archive: {e}")

# 4. Prepare DataFrame for aggregation
parsed_data = []
for item in launches_by_id.values():
    launch_year = item.get("year")
    leo_kg = item.get("leo_kg", 0.0)
    cost = item.get("cost")
    country_code = item.get("country", "")

    payload_tons = leo_kg / 1000.0
    cost_per_kg = (cost / leo_kg) if (cost and leo_kg > 0) else None
    region = map_country(country_code)

    parsed_data.append({
        "Launch_Year": launch_year,
        "Country_Region": region,
        "Payload_Capacity": payload_tons,
        "Cost_Per_Kg": cost_per_kg
    })

df = pd.DataFrame(parsed_data)
if df.empty:
    print("No launch data available to process!")
    sys.exit(0)

start_year = int(df['Launch_Year'].min())
end_year = int(df['Launch_Year'].max())
print(f"Processing data for years {start_year} to {end_year}...")

yearly_capacity = df.groupby(['Launch_Year', 'Country_Region'])['Payload_Capacity'].sum().unstack(fill_value=0.0)

regions = ['USA', 'China', 'Russia', 'Europe', 'Japan', 'India']
for r in regions:
    if r not in yearly_capacity.columns:
        yearly_capacity[r] = 0.0

all_years = list(range(start_year, end_year + 1))
yearly_capacity = yearly_capacity.reindex(all_years, fill_value=0.0)

# 2. Average cost per kg by Decade
df['Decade'] = (df['Launch_Year'] // 10) * 10
decade_cost = df.groupby(['Decade', 'Country_Region'])['Cost_Per_Kg'].mean().unstack()

for r in regions:
    if r not in decade_cost.columns:
        decade_cost[r] = float('nan')
decade_cost = decade_cost[regions]

decade_labels = [f"{int(d)}s" for d in decade_cost.index]
decade_series = {}
for r in regions:
    vals = []
    for d in decade_cost.index:
        v = decade_cost.loc[d, r]
        vals.append(round(float(v), 0) if pd.notna(v) and v > 0 else None)
    decade_series[r] = vals

capacity_series = {}
for r in regions:
    capacity_series[r] = [round(float(v), 1) for v in yearly_capacity[r]]

total_capacity = [round(float(v), 1) for v in yearly_capacity[regions].sum(axis=1)]

today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

data = {
    "last_updated": today_str,
    "regions": regions,
    "payload_capacity": {
        "years": all_years,
        "totals": total_capacity,
        "series": capacity_series
    },
    "decade_costs": {
        "decades": decade_labels,
        "series": decade_series
    }
}

os.makedirs(os.path.dirname(default_output_json), exist_ok=True)
with open(default_output_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

print(f"Space payloads data successfully exported to {default_output_json}")
