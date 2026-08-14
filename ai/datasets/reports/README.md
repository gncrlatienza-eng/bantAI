# Validated user report exports

**Sprint 4 · Track B (AI/ML) · WBS 4.3.5**

Drop admin-validated user reports here as CSV or JSONL, then point the
retraining pipeline at this directory:

```bash
cd ai && python scripts/retrain.py --reports-dir datasets/reports --dry-run
```

The files themselves are **gitignored** — they contain real reported SMS
bodies, the same reason `datasets/labeled/*.csv` is not pushed. Only this
README is tracked.

---

## Format

| Column | Required | Notes |
|---|---|---|
| `text` | ✅ | The **raw** message body, un-masked. Preprocessing happens inside the training path so training input matches inference input exactly — do not pre-mask. |
| `label` | ✅ | `Ham` / `Spam` / `Scam` (any casing), or the id `0` / `1` / `2`. |
| `report_id` | — | Opaque identifier. Carried into the snapshot manifest so a surprising row can be traced back. |
| `validated_at` | — | ISO-8601. Used so a retrain consumes only reports newer than the previous run. Rows without it are always included. |

Extra columns are ignored.

```csv
text,label,report_id,validated_at
"GCash: Your account is suspended. Verify at bit.ly/x",Scam,rpt_8812,2026-08-09T14:22:00Z
"Your OTP is 402913. Do not share.",Ham,rpt_8813,2026-08-09T15:01:00Z
```

---

## Only *validated* reports belong here

The retraining trigger counts validated reports specifically — 50 of them is
one of the three conditions that fires a retrain (`retraining/triggers.py`).
Counting raw submissions would let a single confused or malicious user force
retraining at will.

Nothing in this directory can verify that property. It is the exporter's
responsibility to include only reports an admin has marked **Validated**
(WBS 4.3.2).

---

## This is a stopgap

The real source is the `UserReports` table (**WBS 4.3.1, Track A**), which does
not exist yet. When it lands, a `DatabaseReportSource` implementing the same
two methods as `FileReportSource` (`fetch`, `describe`) drops into
`retraining/reports.py` with no change to the snapshot or pipeline code — the
interface exists precisely so that swap is a non-event.

Until then, running without `--reports-dir` is the honest default: the manifest
records `null (no report store configured)` rather than implying reports were
consulted and none were found.
