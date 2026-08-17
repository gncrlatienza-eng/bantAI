# Validated user report exports

**Sprint 4 · Track B (AI/ML) · WBS 4.3.5**

Admin-validated user reports as CSV or JSONL, read by `FileReportSource`:

```bash
cd ai && python scripts/retrain.py --reports-dir datasets/reports --dry-run
```

**This is the offline route, not the primary one.** The live source is the
backend's `UserReport` table, read directly by `DatabaseReportSource`:

```bash
cd ai && python scripts/retrain.py --reports-url http://localhost:3000/api --dry-run
```

Use this directory when the machine doing the training cannot reach the
backend — which in practice means Colab, since it has no route to a laptop's
`localhost:3000`. Fill it from the database rather than by hand:

```bash
cd ai && python scripts/retrain.py --export-reports datasets/reports/validated.csv \
    --reports-url http://localhost:3000/api
```

The export writes exactly the columns documented below, so the two sources
round-trip.

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
(WBS 4.3.2) — which is the main reason to fill it with `--export-reports`
rather than by hand: `DatabaseReportSource` applies that filter for you.

---

## No source is ever used implicitly

Running without `--reports-dir` or `--reports-url` is a real choice, and the
manifest records it as one: `null (no report store consulted)`, not a zero that
reads like "none were filed". A `BANTAI_AI_BACKEND_URL` sitting in the
environment is not enough on its own to turn the database source on.

`DatabaseReportSource` drops in behind the same two methods as
`FileReportSource` (`fetch`, `describe`) with no change to the snapshot or
pipeline code — the interface existed precisely so that swap would be a
non-event, and it was.
