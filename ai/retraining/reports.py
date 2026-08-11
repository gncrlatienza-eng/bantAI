"""Validated-report sources for retraining snapshots (Sprint 4, WBS 4.3.5).

Retraining trains on the existing labeled dataset **plus** the user reports an
admin has marked Validated since the last run. Those reports are the entire
point of the exercise -- they are confirmed mistakes, the one source of signal
that says where the deployed model is actually wrong.

The canonical home for them is the ``UserReports`` table (WBS 4.3.1, Track A),
which does not exist yet. Rather than block the whole pipeline on it, the
report *source* is an interface with two implementations:

- :class:`NullReportSource` -- yields nothing. The honest default while there
  is no report store. Retraining still runs; it just refreshes the model on
  the existing dataset and the snapshot manifest records zero reports, so no
  reader can mistake it for a correction-driven retrain.
- :class:`FileReportSource` -- reads CSV/JSONL out of a directory. Works today
  for offline experiments and for a manual export from whatever Track A ends
  up building.

When ``UserReports`` lands, a ``DatabaseReportSource`` implementing the same
two methods drops in with no change to :mod:`retraining.snapshot` or
:mod:`retraining.pipeline`. That is the whole reason the seam exists.

Note the deliberate asymmetry with the rest of ``retraining/``: every other
module here is pure. This one touches the filesystem, because "where do
reports come from" is inherently an I/O question. It is kept in its own module
so that impurity stays quarantined and the policy modules remain trivially
testable.
"""

from __future__ import annotations

import csv
import glob
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Iterator, List, Optional, Protocol, runtime_checkable

from training.config import LABEL2ID

#: Case-insensitive label-name lookup. Datasets and hand-built exports vary in
#: casing ("Scam", "scam", "SCAM"); the model only knows the ids.
_LABEL_LOOKUP = {name.lower(): idx for name, idx in LABEL2ID.items()}
_ID_TO_NAME = {idx: name for name, idx in LABEL2ID.items()}


class ReportFormatError(ValueError):
    """A report row could not be read as (text, label).

    Raised rather than skipped. A malformed export is far more likely to be a
    broken column mapping than one bad row, and silently dropping rows would
    quietly shrink the correction set that justified retraining in the first
    place.
    """


@dataclass(frozen=True)
class ValidatedReport:
    """One admin-validated user report, ready to join a training snapshot.

    Attributes:
        text: The **raw** message body, un-masked. Preprocessing happens once,
            inside the training path, so that training input is produced by
            exactly the same code as inference input.
        label: Canonical label name -- one of ``Ham`` / ``Spam`` / ``Scam``.
        report_id: Whatever the source calls this report. Carried through to
            the snapshot manifest so a surprising row can be traced back.
        validated_at: When an admin validated it, if known. Used for
            ``since``-filtering so a retrain consumes only reports newer than
            the last run.
    """

    text: str
    label: str
    report_id: Optional[str] = None
    validated_at: Optional[datetime] = None


@runtime_checkable
class ReportSource(Protocol):
    """Where validated reports come from.

    Two methods on purpose. ``describe`` exists because the snapshot manifest
    has to record *which* source produced a run's reports -- "0 reports" from
    a null source and "0 reports" from a live database that genuinely had none
    are very different facts when investigating a regression months later.
    """

    def fetch(self, since: Optional[datetime] = None) -> Iterable[ValidatedReport]:
        """Yield validated reports, optionally only those newer than ``since``."""
        ...

    def describe(self) -> str:
        """Short human-readable identity of this source, for the manifest."""
        ...


class NullReportSource:
    """No reports available. The default until WBS 4.3.1 (Track A) exists.

    Deliberately not an error. A retrain with zero reports is a legitimate
    operation -- it is what you do to reproduce a checkpoint, or to refresh
    the model after the labeled dataset itself is corrected. What would be
    wrong is *pretending* reports were consulted, which ``describe`` prevents.
    """

    def fetch(
        self, since: Optional[datetime] = None
    ) -> Iterable[ValidatedReport]:
        return ()

    def describe(self) -> str:
        return "null (no report store configured; WBS 4.3.1 not yet available)"


def _coerce_label(value) -> str:
    """Normalize a label cell to a canonical name.

    Accepts the integer ids the model uses (0/1/2) and the string names in any
    casing, because exports come from several places and none of them agree.
    """
    if isinstance(value, str):
        key = value.strip().lower()
        if key in _LABEL_LOOKUP:
            return _ID_TO_NAME[_LABEL_LOOKUP[key]]
        # Fall through: might be a stringified id like "2".
        try:
            value = int(key)
        except ValueError:
            raise ReportFormatError(
                f"Unrecognised label {value!r}; expected one of "
                f"{sorted(LABEL2ID)} or an id in {sorted(_ID_TO_NAME)}"
            ) from None
    try:
        idx = int(value)
    except (TypeError, ValueError):
        raise ReportFormatError(f"Unrecognised label {value!r}") from None
    if idx not in _ID_TO_NAME:
        raise ReportFormatError(
            f"Label id {idx} out of range; expected one of {sorted(_ID_TO_NAME)}"
        )
    return _ID_TO_NAME[idx]


def _parse_timestamp(value) -> Optional[datetime]:
    """Best-effort ISO-8601 parse. Unparseable or absent -> None.

    Unlike a bad label, an unreadable timestamp is not fatal: it only costs
    the row its ``since`` filtering, and dropping a validated correction over
    a formatting quirk would be the worse outcome. Rows without a usable
    timestamp are always included (see :func:`_after`).
    """
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    # ``fromisoformat`` rejects the trailing "Z" before Python 3.11.
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _as_utc(value: datetime) -> datetime:
    """Attach UTC to a naive datetime so mixed-awareness comparison is safe.

    Exports carry either kind -- an ISO string with an offset parses aware,
    one without parses naive -- and Python raises TypeError on comparing the
    two. Assuming UTC for naive values is the only workable default here, and
    is what the backend emits.
    """
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _after(report: ValidatedReport, since: Optional[datetime]) -> bool:
    """Whether ``report`` should survive a ``since`` filter.

    A report with no known ``validated_at`` is **kept**. Excluding it would
    silently discard a real correction because of missing metadata; including
    it risks re-training on a row the previous run already saw, which is
    harmless -- the snapshot de-duplicates anyway.
    """
    if since is None or report.validated_at is None:
        return True
    return _as_utc(report.validated_at) > _as_utc(since)


class FileReportSource:
    """Reads validated reports from CSV/JSONL files in a directory.

    Expected columns (extras are ignored):

        ``text``          -- raw message body                      *required*
        ``label``         -- Ham / Spam / Scam, or 0 / 1 / 2        *required*
        ``report_id``     -- opaque identifier                       optional
        ``validated_at``  -- ISO-8601 timestamp                      optional

    Only reports an admin has already validated belong in these files. The
    threshold in :mod:`retraining.triggers` counts *validated* reports
    specifically -- counting raw submissions would let one confused or
    malicious user force a retrain at will -- and this source has no way to
    check that property itself, so it is the exporter's responsibility.
    """

    def __init__(self, directory: str) -> None:
        self.directory = directory

    def _files(self) -> List[str]:
        if not os.path.isdir(self.directory):
            return []
        return sorted(
            glob.glob(os.path.join(self.directory, "*.csv"))
            + glob.glob(os.path.join(self.directory, "*.jsonl"))
            + glob.glob(os.path.join(self.directory, "*.json"))
        )

    def _read_file(self, path: str) -> Iterator[dict]:
        if path.endswith(".csv"):
            with open(path, newline="", encoding="utf-8") as handle:
                yield from csv.DictReader(handle)
        elif path.endswith(".jsonl"):
            with open(path, encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if line:
                        yield json.loads(line)
        else:
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
            if isinstance(payload, dict):
                payload = payload.get("reports", [])
            yield from payload

    def fetch(
        self, since: Optional[datetime] = None
    ) -> Iterable[ValidatedReport]:
        for path in self._files():
            for lineno, row in enumerate(self._read_file(path), start=1):
                if "text" not in row or "label" not in row:
                    raise ReportFormatError(
                        f"{os.path.basename(path)} row {lineno}: expected "
                        f"'text' and 'label' columns, got {sorted(row)}"
                    )
                text = str(row["text"]).strip()
                if not text:
                    raise ReportFormatError(
                        f"{os.path.basename(path)} row {lineno}: empty text"
                    )
                report = ValidatedReport(
                    text=text,
                    label=_coerce_label(row["label"]),
                    report_id=(
                        str(row["report_id"]) if row.get("report_id") else None
                    ),
                    validated_at=_parse_timestamp(row.get("validated_at")),
                )
                if _after(report, since):
                    yield report

    def describe(self) -> str:
        files = self._files()
        if not files:
            return f"file:{self.directory} (no report files present)"
        names = ", ".join(os.path.basename(f) for f in files)
        return f"file:{self.directory} ({names})"
