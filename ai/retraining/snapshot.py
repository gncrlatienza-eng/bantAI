"""Training-snapshot assembly (Sprint 4, WBS 4.3.5).

A retraining run trains on a *snapshot*: the existing labeled dataset combined
with the validated reports collected since the last run, frozen to disk so the
exact input of every run stays recoverable. ``RETRAINING.md`` Stage 3.

Three decisions shape this module, and each one is a place where the obvious
implementation is wrong.

**Reports are never sampled away.** The natural reading of "combine, then
reservoir-sample" is to pool everything and draw uniformly. That would let a
cap of 16,000 discard some of the 50 validated corrections that triggered the
retrain -- throwing away the only new signal in the run to make room for
history the model already learned. So reports are always included in full, and
the reservoir samples the *historical* side down to whatever budget remains.
The reservoir's job is to keep the historical draw uniform (rather than
"newest N", which over-represents whichever campaign was active that week);
it was never meant to ration corrections.

**Report labels win on collision.** A validated report saying "this is Scam"
about a message the dataset has as Ham is a human correction of that row. If
the dataset copy survived, retraining would train on both readings of the same
text and learn nothing from the correction.

**De-duplication compares masked text; the snapshot stores raw text.** Two
different raw messages collapse to the same model input once PII is masked --
``...libre 1q2w3e7.ca`` and ``...libre 1q2w3e8.ca`` both become
``...libre <URL>``. Comparing raw text would let those survive as separate
rows, which is the leakage ``training/dataset.py`` already guards against on
the train/val split. But what gets *written* is the raw body, so the training
path performs its own preprocessing exactly as it always has -- masked text is
a comparison key here, never a stored artifact.
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from preprocessing import preprocess

from .reports import ValidatedReport
from .sampling import reservoir_sample

#: Filenames inside a snapshot directory.
SNAPSHOT_CSV = "snapshot.csv"
MANIFEST_JSON = "manifest.json"

#: The snapshot CSV lives in its own subdirectory so that
#: ``TrainingConfig.dataset_path`` can point at it directly. ``training/
#: dataset.py`` globs ``*.csv``/``*.json``/``*.jsonl`` out of that path, so a
#: manifest sitting beside the data would be parsed as training data.
DATA_SUBDIR = "snapshot"


@dataclass(frozen=True)
class SnapshotRow:
    """One training example. ``text`` is raw; masking happens at training time."""

    text: str
    label: str
    #: ``"dataset"`` or ``"report"`` -- retained in the CSV so a run's input can
    #: be split back apart when investigating what the corrections changed.
    origin: str


@dataclass
class SnapshotManifest:
    """Everything needed to explain, audit, or regenerate a snapshot.

    Written next to the data because a training input that cannot be accounted
    for makes a regression impossible to investigate -- the run that produced a
    bad checkpoint is exactly the run whose inputs you need months later.
    """

    created_at: str
    seed: Optional[int]
    report_source: str
    max_history: Optional[int]

    #: True when no fine-tune followed. Recorded because the "reports since the
    #: last retrain" watermark must skip these runs -- a dry run consumed
    #: nothing, so letting it advance the watermark would make the next real
    #: run silently skip every report the dry run looked at.
    dry_run: bool = False

    n_reports: int = 0
    n_dataset_rows_seen: int = 0
    n_dataset_duplicates_dropped: int = 0
    n_dataset_rows_superseded_by_report: int = 0
    n_reports_that_relabelled_a_row: int = 0
    n_history_after_sampling: int = 0
    n_total: int = 0

    label_counts: Dict[str, int] = field(default_factory=dict)
    report_ids: List[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)


def build_snapshot(
    dataset_rows: Iterable[Tuple[str, str]],
    reports: Iterable[ValidatedReport],
    max_history: Optional[int] = None,
    seed: Optional[int] = None,
    report_source: str = "unspecified",
) -> Tuple[List[SnapshotRow], SnapshotManifest]:
    """Combine the labeled dataset with validated reports into one training set.

    Pure: no filesystem, no model. ``dataset_rows`` is consumed exactly once,
    so a generator streaming out of a CSV (or, later, the database) is fine and
    is the intended usage -- the reservoir exists precisely so the caller never
    has to materialise the full population.

    Args:
        dataset_rows: ``(raw_text, label_name)`` pairs from the labeled dataset.
        reports: Admin-validated reports. Always included in full.
        max_history: Cap on rows drawn from ``dataset_rows``. ``None`` (the
            default) uses all of them -- at the current ~16.8k rows there is no
            reason to sample, and sampling by default would silently discard
            training data. Set this only when the dataset outgrows what one
            retraining cycle should consume.
        seed: Fixes the reservoir RNG so a snapshot can be regenerated.
            Mandatory in practice for any run you intend to compare against
            another; pass ``TrainingConfig.seed``.
        report_source: ``ReportSource.describe()`` output, for the manifest.

    Returns:
        ``(rows, manifest)``. Reports come first in ``rows``, then history.
    """
    report_list = list(reports)

    # Masked text -> the report that owns it. Later reports win over earlier
    # ones for the same message: a re-validated correction supersedes a stale
    # one, and there is no reading under which the older label should survive.
    by_masked: Dict[str, ValidatedReport] = {}
    for report in report_list:
        by_masked[preprocess(report.text)] = report

    manifest = SnapshotManifest(
        created_at=datetime.now(timezone.utc).isoformat(),
        seed=seed,
        report_source=report_source,
        max_history=max_history,
        n_reports=len(by_masked),
        report_ids=[r.report_id for r in by_masked.values() if r.report_id],
    )

    def history() -> Iterable[SnapshotRow]:
        """Stream dataset rows, dropping duplicates and report-superseded rows."""
        seen: set = set()
        for raw_text, label in dataset_rows:
            manifest.n_dataset_rows_seen += 1
            masked = preprocess(str(raw_text))

            superseding = by_masked.get(masked)
            if superseding is not None:
                manifest.n_dataset_rows_superseded_by_report += 1
                if superseding.label != label:
                    manifest.n_reports_that_relabelled_a_row += 1
                continue

            if masked in seen:
                manifest.n_dataset_duplicates_dropped += 1
                continue
            seen.add(masked)

            yield SnapshotRow(text=str(raw_text), label=label, origin="dataset")

    if max_history is None:
        sampled = list(history())
    else:
        # Budget is what is left after the reports, which are non-negotiable.
        # A cap smaller than the report count yields no history at all rather
        # than dropping corrections -- max() keeps that from going negative.
        budget = max(0, max_history - len(by_masked))
        sampled = reservoir_sample(history(), budget, seed=seed)

    manifest.n_history_after_sampling = len(sampled)

    rows = [SnapshotRow(text=r.text, label=r.label, origin="report") for r in by_masked.values()] + sampled

    manifest.n_total = len(rows)
    counts: Dict[str, int] = {}
    for row in rows:
        counts[row.label] = counts.get(row.label, 0) + 1
    manifest.label_counts = dict(sorted(counts.items()))

    return rows, manifest


def write_snapshot(
    rows: List[SnapshotRow],
    manifest: SnapshotManifest,
    run_dir: str,
) -> str:
    """Write the snapshot and its manifest under ``run_dir``.

    Layout::

        run_dir/
            manifest.json
            snapshot/
                snapshot.csv     <- point TrainingConfig.dataset_path here

    Returns the directory to hand to ``TrainingConfig.dataset_path``. The
    nesting is not decoration: ``training/dataset.py`` globs every
    ``*.csv``/``*.json``/``*.jsonl`` in its dataset path, so a manifest stored
    alongside the CSV would be read as training data.
    """
    data_dir = os.path.join(run_dir, DATA_SUBDIR)
    os.makedirs(data_dir, exist_ok=True)

    csv_path = os.path.join(data_dir, SNAPSHOT_CSV)
    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label", "origin"])
        for row in rows:
            writer.writerow([row.text, row.label, row.origin])

    with open(os.path.join(run_dir, MANIFEST_JSON), "w", encoding="utf-8") as handle:
        handle.write(manifest.to_json())

    return data_dir


def read_labeled_dataset(path: str) -> Iterable[Tuple[str, str]]:
    """Stream ``(text, label)`` out of the labeled dataset directory.

    Mirrors ``training/dataset._read_files``: same file types, and the same
    exclusion of ``sample.csv`` (the hand-written format reference documented
    in ``ai/README.md``, whose 9 dummy rows must never reach a training set).
    Streams row by row rather than concatenating DataFrames, so the reservoir
    keeps its single-pass, fixed-memory property.
    """
    import glob as _glob

    files = sorted(
        _glob.glob(os.path.join(path, "*.csv"))
        + _glob.glob(os.path.join(path, "*.jsonl"))
        + _glob.glob(os.path.join(path, "*.json"))
    )
    files = [f for f in files if not os.path.basename(f).startswith("sample")]
    if not files:
        raise FileNotFoundError(
            f"No .csv/.json/.jsonl files found in '{path}'. Add labeled data before retraining (see ai/README.md)."
        )

    for file_path in files:
        if file_path.endswith(".csv"):
            with open(file_path, newline="", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    if row.get("text") and row.get("label") is not None:
                        yield str(row["text"]), str(row["label"])
        else:
            with open(file_path, encoding="utf-8") as handle:
                if file_path.endswith(".jsonl"):
                    records = [json.loads(line) for line in handle if line.strip()]
                else:
                    records = json.load(handle)
            for row in records:
                if row.get("text") and row.get("label") is not None:
                    yield str(row["text"]), str(row["label"])
