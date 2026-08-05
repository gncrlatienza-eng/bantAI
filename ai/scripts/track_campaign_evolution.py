"""Campaign evolution report CLI (Sprint 4, WBS 4.3.8).

Compares the latest ``campaign_clusters.json`` against a previous snapshot
and prints/writes what changed -- new campaigns, dissolved ones, growth,
surges, new domains, merges, and merge candidates. See
``campaign_evolution.py`` for the comparison logic itself (pure, no I/O).

By default compares the current snapshot against the most recent archived
one in ``datasets/processed/campaign_snapshots/`` (written automatically by
``cluster_campaigns.py`` each time it runs -- see that script's snapshot
archiving step). Pass ``--previous`` to compare against a specific file
instead.

Run:  cd ai && python scripts/cluster_campaigns.py          # produces a new snapshot
      cd ai && python scripts/track_campaign_evolution.py   # reports what changed
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, ".")

from campaign_evolution import detect_evolution

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
OUT_DIR = os.path.join(AI, "datasets", "processed")
SNAPSHOT_DIR = os.path.join(OUT_DIR, "campaign_snapshots")
CURRENT_PATH = os.path.join(OUT_DIR, "campaign_clusters.json")
REPORT_PATH = os.path.join(OUT_DIR, "campaign_evolution_report.json")


def _latest_snapshot() -> str:
    candidates = sorted(glob.glob(os.path.join(SNAPSHOT_DIR, "campaign_clusters_*.json")))
    if not candidates:
        raise SystemExit(
            f"No archived snapshots in {SNAPSHOT_DIR}. Run scripts/cluster_campaigns.py "
            f"at least twice before comparing evolution (nothing to diff against yet on "
            f"the very first run)."
        )
    return candidates[-1]


def _load_snapshot(path: str) -> tuple:
    """Returns ``(clusters, n_messages)``.

    ``n_messages`` is the population that run clustered over; evolution
    comparison needs it because every run re-clusters the whole population,
    so raw cluster sizes are not comparable across snapshots taken over
    different-sized datasets. Older snapshots predating that field return
    ``None``, which degrades to raw-count growth rather than failing.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["clusters"], data.get("n_messages")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--previous", default=None,
        help="Path to a previous campaign_clusters.json-shaped file. "
             "Defaults to the most recently archived snapshot.",
    )
    parser.add_argument(
        "--current", default=CURRENT_PATH,
        help="Path to the current campaign_clusters.json.",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.current):
        raise SystemExit(f"No current snapshot at {args.current}. Run cluster_campaigns.py first.")
    previous_path = args.previous or _latest_snapshot()

    previous, prev_population = _load_snapshot(previous_path)
    current, cur_population = _load_snapshot(args.current)

    report = detect_evolution(
        previous,
        current,
        previous_population=prev_population,
        current_population=cur_population,
    )

    print("=" * 72)
    print("Campaign evolution report")
    print(f"  previous: {os.path.relpath(previous_path, AI)} "
          f"({len(previous)} clusters, {prev_population} messages)")
    print(f"  current : {os.path.relpath(args.current, AI)} "
          f"({len(current)} clusters, {cur_population} messages)")
    print("=" * 72)

    if prev_population is None or cur_population is None:
        print("\n  WARN  A snapshot is missing n_messages -- growth falls back to raw\n"
              "        counts, which inflate whenever the dataset itself grows.")

    print(f"\nNew campaigns       : {len(report.new_campaigns)}")
    print(f"Dissolved campaigns : {len(report.dissolved_campaigns)}")
    print(f"Continuing campaigns: {len(report.continuing)}")
    print(f"Merges              : {len(report.merges)}")
    print(f"Splits              : {len(report.splits)}")
    print(f"Merge candidates    : {len(report.merge_candidates)}")

    surging = report.surging()
    if surging:
        print(f"\nSurging ({len(surging)}) -- by share of traffic, not raw count:")
        for c in surging:
            share = c.share_growth_ratio
            measure = (f"{share:.1f}x share" if share is not None
                       else f"{c.growth_ratio:.1f}x raw")
            print(f"  cluster {c.current_id}: {c.size_before} -> {c.size_after} msgs "
                  f"({measure})")

    new_domains = [c for c in report.continuing if c.new_domains]
    if new_domains:
        print(f"\nNew domains ({len(new_domains)} campaigns):")
        for c in new_domains:
            print(f"  cluster {c.current_id}: {', '.join(c.new_domains[:5])}")

    if report.merges:
        print(f"\nMerges ({len(report.merges)}):")
        for m in report.merges:
            print(f"  {m.previous_ids} -> {m.current_id} "
                  f"({m.size_before_total} -> {m.size_after} msgs)")

    if report.splits:
        print(f"\nSplits ({len(report.splits)}) -- campaign fragmented into variants:")
        for s in report.splits:
            print(f"  {s.previous_id} -> {s.primary_id} + {s.offshoot_ids} "
                  f"({s.size_before} -> {s.size_after_total} msgs)")

    if report.merge_candidates:
        print(f"\nMerge candidates ({len(report.merge_candidates)}) -- review for manual merge:")
        for a, b, sim in report.merge_candidates:
            print(f"  {a} <-> {b}  (similarity {sim:.4f})")

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2)
    print(f"\nWrote {os.path.relpath(REPORT_PATH, AI)}")
    print("=" * 72)


if __name__ == "__main__":
    main()
