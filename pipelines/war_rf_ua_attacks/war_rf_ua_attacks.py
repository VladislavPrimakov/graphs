"""
Russian Aerial Attacks on Ukraine ETL Pipeline
Processes Kaggle dataset 'piterfm/massive-missile-attacks-on-ukraine'
and exports structured JSON to site/src/data/war-rf-ua-attacks.json
"""

import os
import ast
import json
from datetime import datetime, timezone
import pandas as pd
import kagglehub


def run_pipeline():
    print("Downloading/Verifying dataset from Kaggle...")
    path = kagglehub.dataset_download("piterfm/massive-missile-attacks-on-ukraine")
    csv_path = os.path.join(path, "missile_attacks_daily.csv")
    dict_path = os.path.join(path, "missiles_and_uavs.csv")

    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    df["time_start"] = pd.to_datetime(df["time_start"], format="mixed")

    print(f"Loading dictionary from {dict_path}...")
    df_dict = pd.read_csv(dict_path)

    # Create mapping from dictionary
    def map_dict_category(row):
        cat = row["category"]
        w_type = row["type"]
        if pd.isna(cat):
            return "Other"
        cat = str(cat).lower()
        if "uav" in cat:
            if pd.notna(w_type) and "reconnaissance" in str(w_type).lower():
                return "Other"
            return "UAVs"
        elif "ballistic" in cat or "surface-to-air" in cat:
            return "Ballistic"
        elif "cruise" in cat:
            return "Cruise"
        return "Other"

    df_dict["mapped_category"] = df_dict.apply(map_dict_category, axis=1)
    model_to_cat = dict(zip(df_dict["model"], df_dict["mapped_category"]))

    print("Expanding mixed models...")
    new_rows = []
    skipped_composites = {}
    for _, row in df.iterrows():
        if pd.notna(row.get("launched_details")):
            try:
                details = ast.literal_eval(row["launched_details"])
                for model_name, count in details.items():
                    new_row = row.copy()
                    new_row["model"] = model_name
                    new_row["launched"] = count
                    new_rows.append(new_row)
            except Exception:
                new_rows.append(row)
        elif " and " in str(row["model"]) and row["model"] not in model_to_cat:
            model_name = str(row["model"])
            launched_count = row["launched"] if pd.notna(row["launched"]) else 0
            skipped_composites[model_name] = skipped_composites.get(model_name, 0) + launched_count
        else:
            new_rows.append(row)

    df = pd.DataFrame(new_rows)
    df["category"] = df["model"].map(model_to_cat).fillna("Other")

    # Group by month and category
    df["Month_Year"] = df["time_start"].dt.to_period("M")

    # Aggregate launched and destroyed by month and category
    monthly_launched = df.groupby(["Month_Year", "category"])["launched"].sum().unstack(fill_value=0)
    for col in ["UAVs", "Ballistic", "Cruise", "Other"]:
        if col not in monthly_launched.columns:
            monthly_launched[col] = 0

    monthly_launched = monthly_launched.sort_index()

    # Calculate overall monthly totals
    monthly_total_launched = df.groupby("Month_Year")["launched"].sum()
    monthly_total_destroyed = df.groupby("Month_Year")["destroyed"].sum()

    periods = [str(p) for p in monthly_launched.index]
    formatted_months = [f"{p.split('-')[1]}.{p.split('-')[0][-2:]}" for p in periods]

    uavs_launched = [int(v) for v in monthly_launched["UAVs"].values]
    ballistic_launched = [int(v) for v in monthly_launched["Ballistic"].values]
    cruise_launched = [int(v) for v in monthly_launched["Cruise"].values]
    total_missiles = [b + c for b, c in zip(ballistic_launched, cruise_launched)]
    totals_launched = [int(monthly_total_launched.get(p, 0)) for p in monthly_launched.index]
    totals_destroyed = [int(monthly_total_destroyed.get(p, 0)) for p in monthly_launched.index]

    # Summary metrics
    total_uavs = sum(uavs_launched)
    total_ballistic = sum(ballistic_launched)
    total_cruise = sum(cruise_launched)
    total_missiles_launched = total_ballistic + total_cruise
    total_all_launched = sum(totals_launched)
    total_all_destroyed = sum(totals_destroyed)

    num_months = len(periods) if periods else 1

    # UAV stats
    max_uav_idx = uavs_launched.index(max(uavs_launched)) if uavs_launched else 0
    uav_peak_count = max(uavs_launched) if uavs_launched else 0
    uav_peak_period = formatted_months[max_uav_idx] if formatted_months else ""
    uav_monthly_avg = round(total_uavs / num_months) if num_months else 0
    uav_share_pct = round((total_uavs / total_all_launched * 100), 1) if total_all_launched else 0.0

    # Ballistic stats
    max_bal_idx = ballistic_launched.index(max(ballistic_launched)) if ballistic_launched else 0
    bal_peak_count = max(ballistic_launched) if ballistic_launched else 0
    bal_peak_period = formatted_months[max_bal_idx] if formatted_months else ""
    bal_monthly_avg = round(total_ballistic / num_months) if num_months else 0
    bal_share_pct = round((total_ballistic / total_missiles_launched * 100), 1) if total_missiles_launched else 0.0

    # Cruise stats
    max_cruise_idx = cruise_launched.index(max(cruise_launched)) if cruise_launched else 0
    cruise_peak_count = max(cruise_launched) if cruise_launched else 0
    cruise_peak_period = formatted_months[max_cruise_idx] if formatted_months else ""
    cruise_monthly_avg = round(total_cruise / num_months) if num_months else 0
    cruise_share_pct = round((total_cruise / total_missiles_launched * 100), 1) if total_missiles_launched else 0.0

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "site", "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.abspath(os.path.join(output_dir, "war-rf-ua-attacks.json"))

    export_data = {
        "last_updated": today_str,
        "summary": {
            "total_launched": total_all_launched,
            "total_destroyed": total_all_destroyed,
            "total_uavs": total_uavs,
            "total_ballistic": total_ballistic,
            "total_cruise": total_cruise,
            "total_missiles": total_missiles_launched,
            "intercept_rate_pct": round(total_all_destroyed / total_all_launched * 100, 1) if total_all_launched else 0,
            "uavs": {
                "total": total_uavs,
                "monthly_avg": uav_monthly_avg,
                "peak_count": uav_peak_count,
                "peak_period": uav_peak_period,
                "share_pct": uav_share_pct,
            },
            "ballistic": {
                "total": total_ballistic,
                "monthly_avg": bal_monthly_avg,
                "peak_count": bal_peak_count,
                "peak_period": bal_peak_period,
                "share_pct": bal_share_pct,
            },
            "cruise": {
                "total": total_cruise,
                "monthly_avg": cruise_monthly_avg,
                "peak_count": cruise_peak_count,
                "peak_period": cruise_peak_period,
                "share_pct": cruise_share_pct,
            },
        },
        "timeline": {
            "periods": periods,
            "labels": formatted_months,
            "uavs": uavs_launched,
            "ballistic": ballistic_launched,
            "cruise": cruise_launched,
            "total_missiles": total_missiles,
            "total_launched": totals_launched,
            "total_destroyed": totals_destroyed,
        },
    }

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "site", "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.abspath(os.path.join(output_dir, "war-rf-ua-attacks.json"))

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, separators=(',', ':'))

    print(f"Data successfully exported to {output_path}")


if __name__ == "__main__":
    run_pipeline()
