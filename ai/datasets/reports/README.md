# Validated user report exports

**Sprint 4 · Track B (AI/ML) · WBS 4.3.5**

Admin-validated user reports as CSV or JSONL, read by `FileReportSource`:

```bash
cd ai && python scripts/retrain.py --reports-dir datasets/reports --dry-run
```

Live `--reports-url` ingestion is deliberately disabled. The backend retains
privacy-masked SMS only, and retraining must not create a path for raw SMS
persistence or live backend report ingestion. Use this directory for a
separately consented offline export:

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
| `text` | ✅ | A privacy-masked message body from a separately consented export. Do not place raw SMS bodies here. |
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
(WBS 4.3.2). The separately consented export process must apply that filter
before placing files here.

---

## No source is ever used implicitly

Running without `--reports-dir` is a real choice, and the
manifest records it as one: `null (no report store consulted)`, not a zero that
reads like "none were filed". `--reports-url` is intentionally unsupported, and
a `BANTAI_AI_BACKEND_URL` sitting in the environment never enables report
ingestion.

The historical `DatabaseReportSource` implementation remains documented for
provenance, but it is not a supported live ingestion path.
