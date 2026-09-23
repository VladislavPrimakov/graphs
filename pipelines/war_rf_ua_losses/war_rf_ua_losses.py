"""
RF vs Ukraine Equipment Losses ETL Pipeline
Parses lostarmour / warinua KML data and classification rules,
aggregating equipment loss statistics by side, category, model, and month.
Exports structured JSON to site/src/data/war-rf-ua-losses.json.
"""

import os
import re
import json
import argparse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import pandas as pd


CATEGORY_TRANSLATIONS = {
    "самолёты": {"id": "aircraft", "en": "Aircraft", "ru": "Самолёты"},
    "вертолеты": {"id": "helicopters", "en": "Helicopters", "ru": "Вертолёты"},
    "танки": {"id": "tanks", "en": "Tanks", "ru": "Танки"},
    "бронетехника": {"id": "armored", "en": "Armored Vehicles", "ru": "Бронетехника"},
    "артиллерия": {"id": "artillery", "en": "Artillery", "ru": "Артиллерия"},
    "рсзо": {"id": "mlrs", "en": "MLRS", "ru": "РСЗО"},
    "пво": {"id": "air_defense", "en": "Air Defense", "ru": "ПВО"},
    "автотранспорт": {"id": "vehicles", "en": "Support Vehicles", "ru": "Автотранспорт"},
}


def download_kml(file_path, force=False):
    """Downloads latest KML map data from Google My Maps into cache/ if force=True or missing."""
    if not force and os.path.exists(file_path):
        print(f"Using cached KML file: {file_path}")
        return

    url = "https://www.google.com/maps/d/kml?mid=1dRn8TRMDLRkaaIBJad0YZvTt3dmiuxo&forcekml=1"
    dir_name = os.path.dirname(file_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)

    print(f"Downloading latest KML from Google My Maps to {file_path}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=40) as response, open(file_path, "wb") as out_file:
            out_file.write(response.read())
        print(f"Successfully downloaded: {file_path}")
    except Exception as e:
        print(f"Warning: Could not download fresh KML ({e}).")
        if os.path.exists(file_path):
            print("Using existing cached KML file.")
        else:
            raise


def load_classification_rules(json_path):
    if not os.path.exists(json_path):
        print(f"Classification file {json_path} not found.")
        exit(1)
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def determine_side(folder_name):
    folder_name = folder_name.lower() if folder_name else ""
    if "всу" in folder_name:
        return "Украина"
    elif "неопознанное" in folder_name:
        return "Неизвестно"
    else:
        return "РФ"


def clean_name(name):
    if not name:
        return ""
    n = name.lower()
    n = n.replace("\xa0", " ")
    n = re.sub(r"\s*№?\s*(?:rf|ra|рф|ра|rа)[-\s]*\d+", "", n)
    n = re.sub(r"\s+", " ", n)
    return n.strip()


def build_classification_lookup(rules):
    """Pre-build inverted hash map from raw name to (eq_type, canon) for O(1) lookups."""
    lookup = {}
    for eq_type, groups in rules.get("plot", {}).items():
        for canon, raws in groups.items():
            for raw in raws:
                lookup[raw] = (eq_type, canon)
    for eq_type, groups in rules.get("unplot", {}).items():
        for canon, raws in groups.items():
            for raw in raws:
                lookup[raw] = ("Unplot", canon)
    return lookup


def classify_and_normalize(name, lookup):
    return lookup.get(name, ("Другое", name))


def parse_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    match = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})$", date_str)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}"
    match = re.match(r"^(\d{2})\.(\d{4})$", date_str)
    if match:
        month, year = match.groups()
        return f"{year}-{month}"
    return None


def parse_kml(file_path, rules):
    print("Parsing KML file...")
    tree = ET.parse(file_path)
    root = tree.getroot()
    namespace = {"kml": "http://www.opengis.net/kml/2.2"}
    lookup = build_classification_lookup(rules)

    data = []
    unclassified = []

    for folder in root.findall(".//kml:Folder", namespace):
        name_node = folder.find("kml:name", namespace)
        folder_name = name_node.text.strip() if name_node is not None and name_node.text else ""
        side = determine_side(folder_name)

        for placemark in folder.findall("kml:Placemark", namespace):
            pm_name_node = placemark.find("kml:name", namespace)
            pm_name = pm_name_node.text.strip() if pm_name_node is not None and pm_name_node.text else "Без названия"

            pm_name = clean_name(pm_name)
            eq_type, canon_name = classify_and_normalize(pm_name, lookup)

            if eq_type == "Unplot":
                continue

            if eq_type == "Другое":
                if side != "Неизвестно":
                    unclassified.append(pm_name)
                continue

            date_val = None
            extended_data = placemark.find("kml:ExtendedData", namespace)
            if extended_data is not None:
                for d_node in extended_data.findall("kml:Data", namespace):
                    if d_node.get("name") == "дата":
                        val_node = d_node.find("kml:value", namespace)
                        if val_node is not None and val_node.text:
                            date_val = val_node.text.strip()

            month_str = parse_date(date_val)

            data.append({
                "Название": canon_name,
                "Тип": eq_type,
                "Сторона": side,
                "Период": month_str,
                "Есть_дата": month_str is not None,
            })

    return pd.DataFrame(data), unclassified


def export_json(df, rules):
    print("Aggregating statistics for JSON export...")

    types = list(rules.get("plot", {}).keys())
    df_dated = df[df["Есть_дата"] == True]
    all_periods = sorted(df_dated["Период"].dropna().unique())

    # Summary by category
    category_summary = []
    by_category = {}

    overall_side_counts = df["Сторона"].value_counts()
    total_rf = int(overall_side_counts.get("РФ", 0))
    total_ua = int(overall_side_counts.get("Украина", 0))
    total_unk = int(overall_side_counts.get("Неизвестно", 0))

    for eq_type in types:
        type_df = df[df["Тип"] == eq_type]
        type_dated = df_dated[df_dated["Тип"] == eq_type]

        side_counts = type_df["Сторона"].value_counts()
        rf_count = int(side_counts.get("РФ", 0))
        ua_count = int(side_counts.get("Украина", 0))
        unk_count = int(side_counts.get("Неизвестно", 0))
        total_cat = rf_count + ua_count + unk_count

        translations = CATEGORY_TRANSLATIONS.get(eq_type, {"id": eq_type, "en": eq_type.capitalize(), "ru": eq_type})

        cat_summary_item = {
            "id": translations["id"],
            "key": eq_type,
            "label_en": translations["en"],
            "label_ru": translations["ru"],
            "rf": rf_count,
            "ua": ua_count,
            "unknown": unk_count,
            "total": total_cat,
            "ratio": round(rf_count / ua_count, 2) if ua_count > 0 else None,
        }
        category_summary.append(cat_summary_item)

        # Monthly timeline pivot
        rf_timeline = [0] * len(all_periods)
        ua_timeline = [0] * len(all_periods)
        unk_timeline = [0] * len(all_periods)

        if not type_dated.empty:
            pivot = pd.pivot_table(type_dated, index="Период", columns="Сторона", aggfunc="size", fill_value=0)
            pivot = pivot.reindex(all_periods, fill_value=0)
            if "РФ" in pivot.columns:
                rf_timeline = [int(v) for v in pivot["РФ"].values]
            if "Украина" in pivot.columns:
                ua_timeline = [int(v) for v in pivot["Украина"].values]
            if "Неизвестно" in pivot.columns:
                unk_timeline = [int(v) for v in pivot["Неизвестно"].values]

        # Model breakdown
        def get_top_models(side_name, limit=None):
            side_df = type_df[type_df["Сторона"] == side_name]
            if side_df.empty:
                return []
            counts = side_df["Название"].value_counts()
            if limit:
                counts = counts.head(limit)
            return [{"name": name, "count": int(count)} for name, count in counts.items()]

        by_category[translations["id"]] = {
            "id": translations["id"],
            "key": eq_type,
            "label_en": translations["en"],
            "label_ru": translations["ru"],
            "totals": {
                "rf": rf_count,
                "ua": ua_count,
                "unknown": unk_count,
                "total": total_cat,
            },
            "timeline": {
                "rf": rf_timeline,
                "ua": ua_timeline,
                "unknown": unk_timeline,
            },
            "models": {
                "rf": get_top_models("РФ"),
                "ua": get_top_models("Украина"),
                "unknown": get_top_models("Неизвестно"),
            },
            "top_models": {
                "rf": get_top_models("РФ", limit=6),
                "ua": get_top_models("Украина", limit=6),
            },
        }

    # Overall monthly timeline
    overall_pivot = pd.pivot_table(df_dated, index="Период", columns="Сторона", aggfunc="size", fill_value=0)
    overall_pivot = overall_pivot.reindex(all_periods, fill_value=0)

    overall_rf_timeline = [int(v) for v in overall_pivot["РФ"].values] if "РФ" in overall_pivot.columns else [0] * len(all_periods)
    overall_ua_timeline = [int(v) for v in overall_pivot["Украина"].values] if "Украина" in overall_pivot.columns else [0] * len(all_periods)
    overall_unk_timeline = [int(v) for v in overall_pivot["Неизвестно"].values] if "Неизвестно" in overall_pivot.columns else [0] * len(all_periods)

    timeline_rf_series = []
    timeline_ua_series = []
    for idx, period in enumerate(all_periods):
        rf_val = overall_rf_timeline[idx]
        ua_val = overall_ua_timeline[idx]
        breakdown = [
            {
                "id": c["id"],
                "name": c["label_en"],
                "name_ru": c["label_ru"],
                "rf": by_category[c["id"]]["timeline"]["rf"][idx],
                "ua": by_category[c["id"]]["timeline"]["ua"][idx],
            }
            for c in category_summary
        ]
        breakdown.sort(key=lambda x: (x["rf"] + x["ua"]), reverse=True)

        timeline_rf_series.append({
            "value": rf_val,
            "rf": rf_val,
            "ua": ua_val,
            "period": period,
            "breakdown": breakdown,
        })
        timeline_ua_series.append({
            "value": ua_val,
            "rf": rf_val,
            "ua": ua_val,
            "period": period,
            "breakdown": breakdown,
        })

    category_chart = {
        "labels": [c["label_en"] for c in category_summary],
        "rf_series": [{
            "value": c["rf"],
            "label_en": c["label_en"],
            "label_ru": c["label_ru"],
            "ratio": c["ratio"],
        } for c in category_summary],
        "ua_series": [{
            "value": c["ua"],
            "label_en": c["label_en"],
            "label_ru": c["label_ru"],
            "ratio": c["ratio"],
        } for c in category_summary],
    }

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "site", "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.abspath(os.path.join(output_dir, "war-rf-ua-losses.json"))

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    output_data = {
        "last_updated": today_str,
        "summary": {
            "total_records": len(df),
            "total_rf": total_rf,
            "total_ua": total_ua,
            "total_unknown": total_unk,
            "overall_ratio": round(total_rf / total_ua, 2) if total_ua > 0 else None,
            "categories": category_summary,
        },
        "category_chart": category_chart,
        "periods": all_periods,
        "overall_timeline": {
            "rf": overall_rf_timeline,
            "ua": overall_ua_timeline,
            "unknown": overall_unk_timeline,
            "rf_series": timeline_rf_series,
            "ua_series": timeline_ua_series,
        },
        "by_category": by_category,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, separators=(',', ':'))

    print(f"Data successfully exported to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process RF and Ukraine equipment losses from KML.")
    parser.add_argument("-u", "--update", action="store_true", help="Force update (re-download) KML file.")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in locals() else "."
    file_path = os.path.join(script_dir, "cache", "map_data.kml")
    json_path = os.path.join(script_dir, "classification.json")

    download_kml(file_path, force=args.update)
    rules = load_classification_rules(json_path)
    df, unclassified = parse_kml(file_path, rules)
    export_json(df, rules)