"""Download a frozen backend dataset snapshot for a retraining run.

The backend queues retrain jobs that name a ``dataset_version``; until now the
trainer could only use a snapshot an admin downloaded by hand from the Admin
portal. This fetches it directly from the backend's internal route
(``GET /api/internal/datasets/snapshots/:versionTag``, ``AiDatasetsKeyGuard``)
and writes it in the exact JSONL row shape the Admin export produces, so it
drops straight into ``scripts/retrain.py --reports-dir``:

    cd ai && python scripts/fetch_dataset_snapshot.py --dataset-version ds-2026-10-01 \
        --out datasets/reports/ds-2026-10-01
    cd ai && python scripts/retrain.py --reports-dir datasets/reports/ds-2026-10-01 \
        --dataset-version ds-2026-10-01 ...

Needs ``BANTAI_AI_BACKEND_URL`` and ``BANTAI_AI_DATASETS_API_KEY`` (= the
backend's ``AI_DATASETS_API_KEY``), or ``--backend-url``/``--api-key``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Callable, Optional

ENV_BACKEND_URL = "BANTAI_AI_BACKEND_URL"
ENV_DATASETS_API_KEY = "BANTAI_AI_DATASETS_API_KEY"


def fetch_snapshot(base_url: str, api_key: str, version_tag: str, opener: Optional[Callable] = None) -> dict:
    url = base_url.rstrip("/") + "/internal/datasets/snapshots/" + urllib.parse.quote(version_tag, safe="")
    request = urllib.request.Request(url, headers={"x-api-key": api_key})
    open_ = opener or urllib.request.urlopen
    with open_(request, timeout=30) as resp:  # noqa: S310 -- configured backend URL
        return json.loads(resp.read().decode("utf-8"))


def snapshot_to_rows(snapshot: dict) -> list:
    """Mirror DatasetsService.exportSnapshotJsonl row-for-row."""
    tag = snapshot["versionTag"]
    validated_at = snapshot["createdAt"]
    return [
        {
            "text": item["maskedText"],
            "label": item["label"],
            "report_id": f"{item['sampleId']}@v{item['sampleVersion']}",
            "validated_at": validated_at,
            "language": item.get("language"),
            "provenance": item.get("provenance"),
            "dataset_version": tag,
        }
        for item in snapshot.get("items", [])
    ]


def write_jsonl(rows: list, out_dir: str, version_tag: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{version_tag}.jsonl")
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dataset-version", required=True, metavar="TAG")
    parser.add_argument("--out", required=True, help="Directory to write <TAG>.jsonl into.")
    parser.add_argument("--backend-url", default=None)
    parser.add_argument("--api-key", default=None)
    args = parser.parse_args(argv)

    base_url = args.backend_url or os.environ.get(ENV_BACKEND_URL, "")
    api_key = args.api_key or os.environ.get(ENV_DATASETS_API_KEY, "")
    if not base_url or not api_key:
        print(
            f"error: set {ENV_BACKEND_URL} and {ENV_DATASETS_API_KEY} (or pass --backend-url/--api-key).",
            file=sys.stderr,
        )
        return 2
    try:
        snapshot = fetch_snapshot(base_url, api_key, args.dataset_version)
    except Exception as exc:  # noqa: BLE001 -- surfaced to the operator
        print(f"error: could not fetch snapshot {args.dataset_version!r}: {exc}", file=sys.stderr)
        return 1
    rows = snapshot_to_rows(snapshot)
    if not rows:
        print(f"error: snapshot {args.dataset_version!r} has no items.", file=sys.stderr)
        return 1
    path = write_jsonl(rows, args.out, args.dataset_version)
    print(f"Wrote {len(rows)} rows to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
