"""Automated retraining pipeline (Sprint 4, WBS 4.3.5).

Ties the four existing pieces into one run:

    snapshot  ->  fine-tune  ->  score both models  ->  promotion gate

Each stage already exists and is tested on its own (:mod:`retraining.sampling`,
``training/train.py``, :mod:`retraining.promotion`). What was missing is the
orchestration: assembling the snapshot, pointing the trainer at it, scoring the
incumbent and the candidate on *the same rows*, and recording a decision that
can be read back later. ``RETRAINING.md`` Stage 3.

Every run writes a self-contained directory::

    models/retraining_runs/2026-08-11T04-15-33Z/
        manifest.json     what went into the snapshot, and why
        snapshot/
            snapshot.csv  the exact training input
        candidate/        the fine-tuned checkpoint
        decision.json     promote-or-not, with the numbers behind it

Nothing here overwrites the live model. Promotion is a pointer swap owned by
``ModelVersions`` (WBS 4.3.4, Track A), which does not exist yet -- so the
pipeline records a decision and stops. Swapping a checkpoint in as a side
effect of a training run, with no version row to roll back to, is exactly the
unrecoverable step ``RETRAINING.md`` is written to prevent.

**Validation caveat.** The candidate is scored on the held-out 20% of its own
snapshot, which the candidate has genuinely not trained on. The *baseline* may
have seen some of those rows during its original training, since they come
from the same labeled dataset. That biases the comparison conservatively -- in
the incumbent's favour -- so a candidate that clears the gate has cleared a bar
that is, if anything, slightly too high. Worth knowing when reading a close
p-value; a permanently held-out test set would remove the caveat and is the
right fix if this ever becomes the deciding factor.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Sequence

from training.config import TrainingConfig

from .promotion import PromotionDecision, evaluate_promotion
from .reports import NullReportSource, ReportSource
from .snapshot import (
    MANIFEST_JSON,
    SnapshotManifest,
    build_snapshot,
    read_labeled_dataset,
    write_snapshot,
)

#: Where run directories are created, relative to ``ai/``.
DEFAULT_RUNS_ROOT = "models/retraining_runs"

#: The currently promoted checkpoint, i.e. what a candidate is compared against.
DEFAULT_BASELINE_DIR = "models/xlm-roberta-smishing"

CANDIDATE_SUBDIR = "candidate"
DECISION_JSON = "decision.json"

#: Colons are legal in POSIX paths but not on Windows, and this project is
#: developed on both. Keep run directories sortable without being unportable.
_RUN_STAMP = "%Y-%m-%dT%H-%M-%SZ"


@dataclass
class RetrainingRun:
    """The record of one retraining attempt."""

    run_dir: str
    snapshot_dir: str
    manifest: SnapshotManifest
    dry_run: bool = False
    candidate_dir: Optional[str] = None
    decision: Optional[PromotionDecision] = None
    #: Populated when the run stopped before producing a decision.
    skipped_reason: Optional[str] = None

    @property
    def promoted(self) -> bool:
        """Whether the gate said yes. False for dry runs -- nothing was tested."""
        return bool(self.decision and self.decision.promote)

    def summary(self) -> str:
        lines = [
            f"run:       {self.run_dir}",
            f"snapshot:  {self.manifest.n_total} rows "
            f"({self.manifest.n_reports} reports + "
            f"{self.manifest.n_history_after_sampling} history)",
            f"labels:    {self.manifest.label_counts}",
            f"source:    {self.manifest.report_source}",
        ]
        if self.manifest.n_reports_that_relabelled_a_row:
            lines.append(
                f"relabels:  {self.manifest.n_reports_that_relabelled_a_row} "
                "dataset row(s) corrected by a validated report"
            )
        if self.dry_run:
            lines.append("result:    DRY RUN -- snapshot written, no training run")
        elif self.skipped_reason:
            lines.append(f"result:    SKIPPED -- {self.skipped_reason}")
        elif self.decision:
            verdict = "PROMOTE" if self.decision.promote else "REJECT"
            lines.append(f"result:    {verdict} -- {self.decision.reason}")
            lines.append(f"macro-F1:  {self.decision.baseline_macro_f1:.4f} -> {self.decision.candidate_macro_f1:.4f}")
        return "\n".join(lines)


def last_run_time(runs_root: str = DEFAULT_RUNS_ROOT) -> Optional[datetime]:
    """When the most recent retraining run assembled its snapshot.

    Used as the ``since`` bound so a run consumes only reports validated after
    the previous one -- the "since the last retrain" in ``RETRAINING.md``
    Stage 3. Reads the manifest rather than the directory mtime, because a
    directory can be copied or touched and the manifest cannot lie about when
    its snapshot was built.

    **Dry runs are skipped.** A dry run assembles a snapshot and stops; no
    model ever consumed those reports. Letting it advance the watermark would
    make the next real run skip every report the dry run merely looked at --
    which is exactly the kind of silent data loss that is invisible until the
    retrained model inexplicably fails to learn a correction.
    """
    if not os.path.isdir(runs_root):
        return None
    stamps: List[datetime] = []
    for entry in sorted(os.listdir(runs_root)):
        manifest_path = os.path.join(runs_root, entry, MANIFEST_JSON)
        if not os.path.isfile(manifest_path):
            continue
        try:
            with open(manifest_path, encoding="utf-8") as handle:
                payload = json.load(handle)
            if payload.get("dry_run"):
                continue
            created = payload.get("created_at")
            if created:
                stamps.append(datetime.fromisoformat(created))
        except (ValueError, OSError, json.JSONDecodeError):
            # A corrupt manifest must not stop a retrain; it only costs this
            # run its `since` bound, and re-consuming reports is harmless
            # (the snapshot de-duplicates).
            continue
    return max(stamps) if stamps else None


def _predict(model_dir: str, masked_texts: Sequence[str], batch_size: int = 32) -> List[int]:
    """Predict label ids for already-masked text.

    Takes masked text rather than raw because the caller obtains its
    validation rows from ``training.dataset.load_split``, which has already run
    the preprocessing pipeline. Re-masking here would put a second pass over
    text that is already ``<URL>``-substituted -- harmless in most cases, but
    it would mean the evaluation input no longer matches the training input,
    which is the one property this comparison depends on.

    Torch and Transformers are imported lazily, matching
    ``service/classifier.py``, so that importing this module (and running its
    unit tests) does not require the heavy ML stack.
    """
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()

    config = TrainingConfig()
    predictions: List[int] = []
    with torch.no_grad():
        for start in range(0, len(masked_texts), batch_size):
            batch = list(masked_texts[start : start + batch_size])
            inputs = tokenizer(
                batch,
                truncation=True,
                max_length=config.max_length,
                padding=True,
                return_tensors="pt",
            )
            logits = model(**inputs).logits
            predictions.extend(int(i) for i in torch.argmax(logits, dim=-1))
    return predictions


def evaluate_candidate(
    baseline_dir: str,
    candidate_dir: str,
    val_texts: Sequence[str],
    val_labels: Sequence[int],
) -> PromotionDecision:
    """Score both checkpoints on the same rows and run the promotion gate.

    The pairing is the whole basis of McNemar's test -- both models must see
    the same rows in the same order -- so the two prediction lists are built
    from one ``val_texts`` sequence and never re-derived.
    """
    baseline_pred = _predict(baseline_dir, val_texts)
    candidate_pred = _predict(candidate_dir, val_texts)
    return evaluate_promotion(val_labels, baseline_pred, candidate_pred)


def run_retraining(
    labeled_dir: str = "datasets/labeled",
    report_source: Optional[ReportSource] = None,
    runs_root: str = DEFAULT_RUNS_ROOT,
    baseline_dir: str = DEFAULT_BASELINE_DIR,
    max_history: Optional[int] = None,
    seed: Optional[int] = None,
    dry_run: bool = False,
    since: Optional[datetime] = None,
    config: Optional[TrainingConfig] = None,
) -> RetrainingRun:
    """Run one retraining cycle end to end.

    Args:
        labeled_dir: The existing labeled dataset directory.
        report_source: Where validated reports come from. Defaults to
            :class:`~retraining.reports.NullReportSource` -- no report store
            exists until WBS 4.3.1 (Track A) lands, and inventing one would be
            worse than recording honestly that there were none.
        runs_root: Parent directory for timestamped run directories.
        baseline_dir: The currently promoted checkpoint to compare against.
        max_history: Cap on historical rows (see :func:`build_snapshot`).
        seed: Reservoir + training seed. Defaults to ``TrainingConfig.seed``.
        dry_run: Assemble and write the snapshot, then stop. Exercises
            everything except the fine-tune, which needs a GPU to be practical.
        since: Only consume reports validated after this. Defaults to the
            previous run's timestamp.
        config: Training hyperparameters. ``dataset_path`` and ``output_dir``
            are overridden to point at this run's directories.

    Returns:
        A :class:`RetrainingRun` describing what happened. Note that a returned
        run with ``promoted`` True has **not** swapped any checkpoint -- see
        the module docstring.
    """
    config = config or TrainingConfig()
    seed = config.seed if seed is None else seed
    source = report_source or NullReportSource()

    if since is None:
        since = last_run_time(runs_root)

    run_dir = os.path.join(runs_root, datetime.now(timezone.utc).strftime(_RUN_STAMP))
    os.makedirs(run_dir, exist_ok=True)

    rows, manifest = build_snapshot(
        dataset_rows=read_labeled_dataset(labeled_dir),
        reports=source.fetch(since),
        max_history=max_history,
        seed=seed,
        report_source=source.describe(),
    )
    manifest.dry_run = dry_run
    snapshot_dir = write_snapshot(rows, manifest, run_dir)

    run = RetrainingRun(
        run_dir=run_dir,
        snapshot_dir=snapshot_dir,
        manifest=manifest,
        dry_run=dry_run,
    )
    if dry_run:
        return run

    # --- Fine-tune (AdamW, class-weighted loss, 80/20 stratified split) ---
    # training/train.py is reused unchanged; only its input and output paths
    # differ. Keeping one training implementation is what makes a retrained
    # checkpoint comparable to the original.
    from training.dataset import load_split
    from training.train import main as train_main

    candidate_dir = os.path.join(run_dir, CANDIDATE_SUBDIR)
    run_config = TrainingConfig(
        **{
            **{k: getattr(config, k) for k in config.__dataclass_fields__},
            "dataset_path": snapshot_dir,
            "output_dir": candidate_dir,
            "seed": seed,
        }
    )
    train_main(run_config)
    run.candidate_dir = candidate_dir

    # --- Promotion gate -------------------------------------------------- #
    if not os.path.isfile(os.path.join(baseline_dir, "config.json")):
        # First-ever model: nothing to compare against, so the gate cannot
        # run. Refusing to invent a verdict is the point -- a fabricated
        # "promote" here would be indistinguishable from a measured one in
        # decision.json.
        run.skipped_reason = (
            f"no baseline checkpoint at '{baseline_dir}'; candidate trained "
            "but not evaluated (nothing to compare against)"
        )
        _write_decision(run)
        return run

    _, val_texts, _, val_labels = load_split(run_config)
    run.decision = evaluate_candidate(baseline_dir, candidate_dir, val_texts, val_labels)
    _write_decision(run)
    return run


def _write_decision(run: RetrainingRun) -> None:
    """Persist the gate's verdict beside the checkpoint it judged.

    Every number the gate used is stored, not just the verdict, because this
    is what gets read back when someone asks why a checkpoint was or was not
    promoted -- and ``ModelVersions`` (WBS 4.3.4) will ingest exactly these
    fields once it exists.
    """
    payload = {
        "run_dir": run.run_dir,
        "candidate_dir": run.candidate_dir,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "skipped_reason": run.skipped_reason,
        "decision": (
            {
                "promote": run.decision.promote,
                "reason": run.decision.reason,
                "baseline_macro_f1": run.decision.baseline_macro_f1,
                "candidate_macro_f1": run.decision.candidate_macro_f1,
                "n_fixes": run.decision.n_fixes,
                "n_regressions": run.decision.n_regressions,
                "p_value": run.decision.p_value,
            }
            if run.decision
            else None
        ),
    }
    with open(os.path.join(run.run_dir, DECISION_JSON), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
