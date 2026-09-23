"""
Master Pipeline Runner
Executes all ETL data pipelines to refresh datasets in site/src/data/
"""

import sys
import os
import subprocess
import argparse
import time
import json

PIPELINES = [
    {
        "name": "Ukraine Economic (Budget, Debt, GDP, Trade)",
        "script": "pipelines/ua_economic/ua_economic.py",
        "supports_update": True,
    },
    {
        "name": "World Economic (Macroeconomic Scale & Industrial Capacity)",
        "script": "pipelines/world_economic/world_economic.py",
        "supports_update": True,
    },
    {
        "name": "Space Launches (Payload Mass to Orbit & Launch Costs)",
        "script": "pipelines/space_launches/space_launches.py",
        "supports_update": True,
    },
    {
        "name": "War RF-UA Attacks (Missiles & UAV Dynamics)",
        "script": "pipelines/war_rf_ua_attacks/war_rf_ua_attacks.py",
        "supports_update": False,
    },
    {
        "name": "War RF-UA Losses (Equipment Losses Comparison)",
        "script": "pipelines/war_rf_ua_losses/war_rf_ua_losses.py",
        "supports_update": True,
    },
]


def main():
    parser = argparse.ArgumentParser(description="Run all data collection and processing pipelines.")
    parser.add_argument("-u", "--update", action="store_true", help="Force redownload latest source files where applicable.")
    args = parser.parse_args()

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 60)
    print("STARTING DATA PIPELINES REFRESH")
    print(f"Root: {root_dir}")
    print(f"Force update: {args.update}")
    print("=" * 60)

    total_start = time.time()
    success_count = 0

    for idx, p in enumerate(PIPELINES, 1):
        cmd = [sys.executable, os.path.join(root_dir, p["script"])]
        if args.update and p["supports_update"]:
            cmd.append("-u")

        print(f"\n[{idx}/{len(PIPELINES)}] Running: {p['name']}...")
        print(f"Command: {' '.join(cmd)}")
        t0 = time.time()
        res = subprocess.run(cmd, cwd=root_dir)
        elapsed = time.time() - t0

        if res.returncode == 0:
            print(f"-> SUCCESS in {elapsed:.2f}s")
            success_count += 1
        else:
            print(f"-> FAILED with code {res.returncode} in {elapsed:.2f}s")

    print("\n" + "=" * 60)
    print(f"PIPELINES FINISHED: {success_count}/{len(PIPELINES)} succeeded in {time.time() - total_start:.2f}s")
    print("=" * 60)

    # Automatically generate site/src/data/metadata.json (gitignored)
    try:
        data_dir = os.path.join(root_dir, "site", "src", "data")
        metadata = {}
        if os.path.exists(data_dir):
            for fname in os.listdir(data_dir):
                if fname.endswith(".json") and fname != "metadata.json":
                    p_id = fname[:-5]
                    fpath = os.path.join(data_dir, fname)
                    with open(fpath, "r", encoding="utf-8") as jf:
                        content = json.load(jf)
                        if isinstance(content, dict) and "last_updated" in content:
                            metadata[p_id] = content["last_updated"]
            with open(os.path.join(data_dir, "metadata.json"), "w", encoding="utf-8") as mf:
                json.dump(metadata, mf, separators=(',', ':'))
            print(f"-> Generated site/src/data/metadata.json ({len(metadata)} projects)")
    except Exception as e:
        print(f"-> Warning: Failed to generate metadata.json: {e}")

    if success_count < len(PIPELINES):
        failed_count = len(PIPELINES) - success_count
        print(f"\n[ERROR] {failed_count} pipeline(s) failed execution!")
        sys.exit(1)


if __name__ == "__main__":
    main()
