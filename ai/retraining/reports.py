"""Validated-report sources for retraining snapshots (Sprint 4, WBS 4.3.5).

Retraining trains on the existing labeled dataset **plus** the user reports an
admin has marked Validated since the last run. Those reports are the entire
point of the exercise -- they are confirmed mistakes, the one source of signal
that says where the deployed model is actually wrong.

The canonical home for them is the ``UserReport`` table (WBS 4.3.1, Track A),
which landed in PR #39. The report *source* is an interface with three
implementations, and which one you get is always an explicit choice:

- :class:`NullReportSource` -- yields nothing. Still the default. Retraining
  runs; it just refreshes the model on the existing dataset and the snapshot
  manifest records zero reports, so no reader can mistake it for a
  correction-driven retrain.
- :class:`FileReportSource` -- reads CSV/JSONL out of a directory. The offline
  route: hand-built experiments, and the export that carries reports to a GPU
  box (Colab cannot reach a laptop's ``localhost:3000``).
- :class:`DatabaseReportSource` -- reads ``GET /reports`` off the NestJS
  backend and keeps the ``Validated`` ones. The production path.

None of them is auto-selected. ``scripts/retrain.py`` requires you to name the
source, because inferring "there is a backend URL in the environment, so
presumably use it" is the same class of mistake as reporting zero reports from
a store that was never consulted.

Note the deliberate asymmetry with the rest of ``retraining/``: every other
module here is pure. This one touches the filesystem *and* the network, because
"where do reports come from" is inherently an I/O question. It is kept in its
own module so that impurity stays quarantined and the policy modules remain
trivially testable.
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


class ReportSourceError(RuntimeError):
    """The report store could not be reached, or answered unusably.

    Raised rather than degraded to an empty list. This is the opposite of the
    policy in ``service/centroid_source.py``, which swallows every failure --
    and the difference is the whole point. An empty centroid list costs one
    enhancement and the service still classifies; an empty *report* list is
    indistinguishable from "no corrections were filed", so a 401 or a typo in
    the URL would quietly produce a retrain that learned from none of the
    mistakes that triggered it, and a manifest saying so in a way no reader
    would question.

    Same failure shape as the dry-run watermark bug in
    :func:`retraining.pipeline.last_run_time`: not a crash, just corrections
    that vanish without anyone being told.
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
    """No reports consulted. Still the default, now by choice rather than need.

    Deliberately not an error. A retrain with zero reports is a legitimate
    operation -- it is what you do to reproduce a checkpoint, or to refresh
    the model after the labeled dataset itself is corrected. What would be
    wrong is *pretending* reports were consulted, which ``describe`` prevents.
    """

    def fetch(self, since: Optional[datetime] = None) -> Iterable[ValidatedReport]:
        return ()

    def describe(self) -> str:
        return "null (no report store consulted)"


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
                f"Unrecognised label {value!r}; expected one of {sorted(LABEL2ID)} or an id in {sorted(_ID_TO_NAME)}"
            ) from None
    try:
        idx = int(value)
    except (TypeError, ValueError):
        raise ReportFormatError(f"Unrecognised label {value!r}") from None
    if idx not in _ID_TO_NAME:
        raise ReportFormatError(f"Label id {idx} out of range; expected one of {sorted(_ID_TO_NAME)}")
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

    def fetch(self, since: Optional[datetime] = None) -> Iterable[ValidatedReport]:
        for path in self._files():
            for lineno, row in enumerate(self._read_file(path), start=1):
                if "text" not in row or "label" not in row:
                    raise ReportFormatError(
                        f"{os.path.basename(path)} row {lineno}: expected 'text' and 'label' columns, got {sorted(row)}"
                    )
                text = str(row["text"]).strip()
                if not text:
                    raise ReportFormatError(f"{os.path.basename(path)} row {lineno}: empty text")
                report = ValidatedReport(
                    text=text,
                    label=_coerce_label(row["label"]),
                    report_id=(str(row["report_id"]) if row.get("report_id") else None),
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


#: The status an admin sets via ``PATCH /reports/:id/validate`` (WBS 4.3.2).
#: Only these rows may enter a snapshot: ``retraining.triggers`` fires on a
#: count of *validated* reports specifically, because counting raw submissions
#: would let one confused or malicious user force a retrain at will.
VALIDATED_STATUS = "Validated"


class DatabaseReportSource:
    """Reads admin-validated reports from the NestJS backend (WBS 4.3.1).

    Hits ``GET {base_url}/reports``, which is ``ApiKeyGuard``-protected, so
    ``api_key`` is sent as ``x-api-key`` and must match the backend's
    ``INTERNAL_API_KEY``.

    **The Validated filter is applied here, not server-side.** ``ReportsService``
    exposes only ``findAll()`` and ``findPending()`` -- there is no
    ``findValidated()`` -- so this fetches every report and keeps the ones whose
    ``status`` is ``Validated``. Fine at thesis scale; the route is also
    unpaginated, so if the table ever grows past a few thousand rows the right
    fix is a server-side filter on Track A's side, not paging from here against
    an API that offers no cursor.

    Field mapping, from the ``findAll`` selection:

        ``message.body``   -> ``text``          the **raw** body, un-masked
        ``reportedLabel``  -> ``label``         what the user says it should be
        ``id``             -> ``report_id``
        ``updatedAt``      -> ``validated_at``

    ``reportedLabel`` rather than ``originalLabel``: the original is what the
    model already said, and training on it would teach the model to repeat the
    mistake that was reported.

    ⚠️ ``updatedAt`` is Prisma ``@updatedAt``, so it moves on *any* write to the
    row -- including an admin editing ``adminNote`` afterwards -- not only on
    validation. It is the closest thing the API exposes to a validation
    timestamp and is a good proxy in practice, but a dedicated ``validatedAt``
    column on ``UserReport`` would be exact. Worth asking Track A for; the only
    cost meanwhile is that a re-touched report can look newer than it is and be
    re-consumed by a later run, which the snapshot de-duplicates anyway.

    Unlike :func:`service.centroid_source.load_centroids`, failures raise --
    see :class:`ReportSourceError`.
    """

    def __init__(self, base_url: str, api_key: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        #: Set by :meth:`fetch` so :meth:`describe` can report real counts.
        #: ``None`` until a fetch happens -- see :meth:`describe`.
        self._last_counts: Optional[tuple] = None

    @property
    def url(self) -> str:
        return f"{self.base_url}/reports"

    def _get(self) -> list:
        """One GET, decoded. Every failure mode becomes ``ReportSourceError``."""
        import urllib.error
        import urllib.request

        request = urllib.request.Request(self.url, headers={"x-api-key": self.api_key})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as resp:  # noqa: S310
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            hint = ""
            if exc.code == 401:
                hint = " -- BANTAI_AI_BACKEND_API_KEY is missing or does not match the backend's INTERNAL_API_KEY"
            raise ReportSourceError(f"GET {self.url} returned HTTP {exc.code} {exc.reason}{hint}") from exc
        except urllib.error.URLError as exc:
            raise ReportSourceError(f"GET {self.url} failed: {exc.reason}. Is the backend running?") from exc
        except json.JSONDecodeError as exc:
            raise ReportSourceError(f"GET {self.url} did not return JSON: {exc}") from exc

        if not isinstance(payload, list):
            raise ReportSourceError(f"GET {self.url} returned {type(payload).__name__}, expected a list of reports")
        return payload

    def fetch(self, since: Optional[datetime] = None) -> List[ValidatedReport]:
        """Fetch validated reports, newest-first order preserved from the API.

        Returns a list rather than a generator, deliberately: the request is a
        single round trip, and deferring it into the middle of
        ``build_snapshot`` would surface a connection failure from inside
        snapshot assembly instead of at the point the source was asked for
        data.
        """
        payload = self._get()

        out: List[ValidatedReport] = []
        for row in payload:
            if row.get("status") != VALIDATED_STATUS:
                continue
            message = row.get("message") or {}
            text = str(message.get("body") or "").strip()
            if not text:
                # Same rule as FileReportSource: a validated report with no
                # body is a broken join or a deleted message, not a row to
                # quietly drop from the correction set.
                raise ReportFormatError(f"report {row.get('id')!r}: validated but its message has no body")
            report = ValidatedReport(
                text=text,
                label=_coerce_label(row.get("reportedLabel")),
                report_id=(str(row["id"]) if row.get("id") else None),
                validated_at=_parse_timestamp(row.get("updatedAt")),
            )
            if _after(report, since):
                out.append(report)

        self._last_counts = (len(out), len(payload))
        return out

    def describe(self) -> str:
        """Identify this source for the snapshot manifest.

        Must stay correct *before* a fetch: ``pipeline.run_retraining`` passes
        ``source.fetch(since)`` and ``source.describe()`` as sibling arguments,
        and :class:`FileReportSource` returns a lazy generator, so no source may
        depend on its own fetch having already run.
        """
        if self._last_counts is None:
            return f"database:{self.url} (status={VALIDATED_STATUS})"
        kept, total = self._last_counts
        return f"database:{self.url} (status={VALIDATED_STATUS}; {kept} of {total} reports)"
