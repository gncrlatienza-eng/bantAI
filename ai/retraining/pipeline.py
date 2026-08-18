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
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import List, Optional, Sequence

from training.config import ID2LABEL, TrainingConfig

from .promotion import PromotionDecision, discordant_indices, evaluate_promotion
from .reports import NullReportSource, ReportSource
from .snapshot import (
    MANIFEST_JSON,
    SnapshotManifest,
    build_snapshot,
    read_labeled_dataset,
    write_snapshot,
)
from .version_file import write_version

#: Where run directories are created, relative to ``ai/``.
DEFAULT_RUNS_ROOT = "models/retraining_runs"

#: The currently promoted checkpoint, i.e. what a candidate is compared against.
DEFAULT_BASELINE_DIR = "models/xlm-roberta-smishing"

CANDIDATE_SUBDIR = "candidate"
DECISION_JSON = "decision.json"

#: Row-level record of every validation message the two models disagreed on.
#: Stays in the run directory (git-ignored) because it reproduces real SMS
#: bodies -- see :func:`_write_disagreements`.
DISAGREEMENTS_JSON = "disagreements.json"

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
    #: ``v<run-stamp>``, e.g. ``v2026-08-17T04-15-33Z`` -- the tag
    #: ``registry.ModelRegistry.register`` would use for this run's
    #: candidate. Set even for dry runs and skipped runs (it costs nothing
    #: and one less special case), but only a run that actually produced a
    #: ``candidate_dir`` has a checkpoint carrying it in ``version.json``.
    version_tag: Optional[str] = None

    @property
    def promoted(self) -> bool:
        """Whether the gate said yes. False for dry runs -- nothing was tested."""
        return bool(self.decision and self.decision.promote)

    def summary(self) -> str:
        lines = [
            f"run:       {self.run_dir}",
            f"version:   {self.version_tag}",
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
        # ``is not None``, not truthiness: PromotionDecision.__bool__ returns
        # ``promote``, so a *rejected* decision is falsy. Testing it directly
        # made the REJECT branch below unreachable -- every rejection printed
        # nothing at all, which is precisely the outcome most worth reporting.
        elif self.decision is not None:
            verdict = "PROMOTE" if self.decision.promote else "REJECT"
            lines.append(f"result:    {verdict} -- {self.decision.reason}")
            lines.append(f"macro-F1:  {self.decision.baseline_macro_f1:.4f} -> {self.decision.candidate_macro_f1:.4f}")
            # Printed because "97 fixes vs 44 regressions" invites exactly one
            # follow-up question, and it should not require opening a file.
            if self.decision.regression_transitions:
                worse = ", ".join(f"{k} x{v}" for k, v in self.decision.regression_transitions.items())
                lines.append(f"worse:     {worse}")
            if self.decision.fix_transitions:
                better = ", ".join(f"{k} x{v}" for k, v in self.decision.fix_transitions.items())
                lines.append(f"better:    {better}")
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

    # Scoring runs on whatever the fine-tune just used. The gate has to run
    # both checkpoints over the full validation split, so on CPU it can take
    # longer than the training it is judging -- on a Colab T4 that is the
    # difference between a couple of minutes and most of an hour. Falls back
    # to CPU cleanly, which is what every unit test uses.
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

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
            ).to(device)
            logits = model(**inputs).logits
            predictions.extend(int(i) for i in torch.argmax(logits, dim=-1))
    return predictions


def _transition_counts(
    indices: Sequence[int],
    val_labels: Sequence[int],
    predictions: Sequence[int],
) -> dict:
    """Summarise a set of disagreements as ``"True->Predicted": count``.

    Deliberately text-free. This is the part safe to commit and quote: it
    answers "what got worse" at the level of *classes* -- ``Scam->Spam: 20``
    says the candidate started under-calling scams -- without reproducing a
    single real message body.
    """
    counts: dict = {}
    for i in indices:
        key = f"{ID2LABEL[int(val_labels[i])]}->{ID2LABEL[int(predictions[i])]}"
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


def _write_disagreements(
    path: str,
    fix_idx: Sequence[int],
    reg_idx: Sequence[int],
    val_texts: Sequence[str],
    val_labels: Sequence[int],
    baseline_pred: Sequence[int],
    candidate_pred: Sequence[int],
) -> None:
    """Write every row the two models disagreed on, with its text.

    ⚠️ **Never commit this file.** It reproduces real SMS bodies from the
    validation split -- masked (``<URL>``, ``<PHONE>``, ``<OTP>``), because
    that is the form the models were scored on, but still real user messages.
    It lands in the run directory, which is covered by ``ai/models/*/`` in
    ``.gitignore``, and must stay there. The committable summary is the
    text-free transition counts in ``decision.json``.

    Written because the counts alone cannot answer "what did the new model
    break?" -- the single most likely question about a promotion, and one a
    finished run previously had no way to answer.
    """

    def rows(indices):
        return [
            {
                "index": int(i),
                "true": ID2LABEL[int(val_labels[i])],
                "baseline": ID2LABEL[int(baseline_pred[i])],
                "candidate": ID2LABEL[int(candidate_pred[i])],
                "text": val_texts[i],
            }
            for i in indices
        ]

    payload = {
        "_warning": (
            "Contains real (masked) SMS bodies. Do not commit; do not paste "
            "into an issue, a chat, or the manuscript. Quote the transition "
            "counts in decision.json instead."
        ),
        "n_fixes": len(fix_idx),
        "n_regressions": len(reg_idx),
        "regressions": rows(reg_idx),
        "fixes": rows(fix_idx),
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def evaluate_candidate(
    baseline_dir: str,
    candidate_dir: str,
    val_texts: Sequence[str],
    val_labels: Sequence[int],
    run_dir: Optional[str] = None,
) -> PromotionDecision:
    """Score both checkpoints on the same rows and run the promotion gate.

    The pairing is the whole basis of McNemar's test -- both models must see
    the same rows in the same order -- so the two prediction lists are built
    from one ``val_texts`` sequence and never re-derived.

    When ``run_dir`` is given, the individual disagreements are also written
    to ``disagreements.json`` there, and the returned decision carries
    text-free transition counts. Both exist so that a promotion can be
    interrogated afterwards rather than only tallied.
    """
    baseline_pred = _predict(baseline_dir, val_texts)
    candidate_pred = _predict(candidate_dir, val_texts)
    decision = evaluate_promotion(val_labels, baseline_pred, candidate_pred)

    fix_idx, reg_idx = discordant_indices(val_labels, baseline_pred, candidate_pred)
    decision = replace(
        decision,
        regression_transitions=_transition_counts(reg_idx, val_labels, candidate_pred),
        fix_transitions=_transition_counts(fix_idx, val_labels, baseline_pred),
    )

    if run_dir:
        _write_disagreements(
            os.path.join(run_dir, DISAGREEMENTS_JSON),
            fix_idx,
            reg_idx,
            val_texts,
            val_labels,
            baseline_pred,
            candidate_pred,
        )
    return decision


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

    # Assemble before creating the directory. A report source that cannot reach
    # its store raises here (see ``reports.ReportSourceError``), and creating
    # the directory first would leave an empty, manifest-less run behind on
    # every such failure -- harmless to ``last_run_time``, which skips them,
    # but it accumulates directories that look like runs and are not.
    rows, manifest = build_snapshot(
        dataset_rows=read_labeled_dataset(labeled_dir),
        reports=source.fetch(since),
        max_history=max_history,
        seed=seed,
        report_source=source.describe(),
    )
    manifest.dry_run = dry_run
    os.makedirs(run_dir, exist_ok=True)
    snapshot_dir = write_snapshot(rows, manifest, run_dir)

    run = RetrainingRun(
        run_dir=run_dir,
        snapshot_dir=snapshot_dir,
        manifest=manifest,
        dry_run=dry_run,
        version_tag=f"v{os.path.basename(run_dir)}",
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

    # version.json travels with the checkpoint from this point on, so a
    # later manual promotion ("point the live model at candidate_dir") does
    # not need a second step to remember it. See version_file.py.
    write_version(candidate_dir, run.version_tag)

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
    run.decision = evaluate_candidate(baseline_dir, candidate_dir, val_texts, val_labels, run_dir=run.run_dir)
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
        "version_tag": run.version_tag,
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
                # Which class confusions the counts consist of. Text-free, so
                # this file stays safe to commit and quote -- "Scam->Spam: 20"
                # answers "what got worse" without reproducing a message.
                "regression_transitions": run.decision.regression_transitions,
                "fix_transitions": run.decision.fix_transitions,
            }
            # ``is not None``, not truthiness. PromotionDecision.__bool__
            # returns ``promote``, so a rejected decision is falsy and this
            # wrote ``"decision": null`` for every candidate the gate turned
            # down -- discarding the reason, both F1 scores and the p-value in
            # exactly the case this file exists to explain.
            if run.decision is not None
            else None
        ),
    }
    with open(os.path.join(run.run_dir, DECISION_JSON), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
