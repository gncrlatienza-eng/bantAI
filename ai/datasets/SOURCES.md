# Data-source register (Gate 1)

> Required by `ai/ML_READINESS_PLAN_2026-09-19.md` §3. **This file must be
> populated and signed off by the adviser/ethics authority before any row from a
> new source is imported into `datasets/labeled/`.**

Every source of SMS text that enters the training, development, or release-test
pools needs one entry below. The purpose is not paperwork — it is the record
the defense packet cites when asked *where each row came from and by what
authority it is here*. A source that cannot be filled in here cannot be used.

## Status as of 2026-09-19

**No source has passed Gate 1.** Existing rows in the ignored
`datasets/labeled/*.csv` predate this register and are covered by the interim
provenance notes in [`bantAI-datasets/README.md`](bantAI-datasets/) (if
present); their status remains **provisional** until each contributing source
is backfilled into an entry below and re-approved. Do not treat the existing
corpus as Gate-1-cleared merely because it exists.

## Required fields — every field is mandatory

| Field | What goes here |
|---|---|
| `source_id` | Short slug, kebab-case, unique. Referenced from the row-level `source` column. |
| `title` | Human-readable name of the dataset or collection. |
| `citation` / `url` | Formal citation for published corpora; canonical URL for online sources; internal doc link for donated inboxes. |
| `provider` | Person or organization who supplied the data. For a real inbox: donor name + relationship to team. |
| `acquired_on` | ISO-8601 date the team took possession. |
| `license_or_permission` | License name, or the written-permission artifact (path/link). For a donated inbox: the signed consent form. |
| `allowed_use` | Explicit list: `research` / `evaluation` / `deployment` / `publication`. Anything not listed is forbidden. |
| `collection_method` | How rows were obtained (web scrape, phone export, survey, partner API, etc.). |
| `original_label_scheme` | What the original labels meant, before mapping to Ham/Spam/Scam. Include the mapping. |
| `language_domain` | Language mix (English/Tagalog/Taglish share) and domain (personal, telco, banking, government, etc.). |
| `fields_present` | Which of `text`, `sender`, `received_at`, `origin` the source provides. Missing fields must be documented, not inferred. |
| `privacy_risks` | PII types present before masking; whether the source is publicly indexed. |
| `preprocessing_applied` | Every transformation between the raw file and the row that enters `datasets/labeled/`. Version-pin any script. |
| `n_rows` | Row count of the untouched source file. |
| `raw_sha256` | SHA-256 of the *untouched* source file, computed once at import time. Use `python -c "from retraining.checksum import sha256_file; print(sha256_file('<path>'))"`. |
| `raw_storage_path` | Where the untouched source file lives (outside Git, access-controlled). |
| `retention_and_deletion` | How long the raw source is kept; who deletes it; the trigger for deletion. |
| `ethics_basis` | Which ethics/consent instrument authorizes this source (IRB approval ID, consent form version). |
| `approved_by` | Adviser / ethics authority name and date of approval. |
| `notes` | Anything that would change how a reader interprets the rows (known biases, oversampled classes, time coverage). |

## Entry template

Copy this block for every new source. Do not delete unused fields; write
`n/a — <reason>` if a field genuinely does not apply, so a reviewer can tell
"not applicable" from "forgot to fill in".

```yaml
- source_id: example-slug
  title: ""
  citation: ""
  url: ""
  provider: ""
  acquired_on: ""            # YYYY-MM-DD
  license_or_permission: ""
  allowed_use: []            # e.g. [research, evaluation]
  collection_method: ""
  original_label_scheme: ""
  language_domain: ""
  fields_present: []         # e.g. [text, sender, received_at]
  privacy_risks: ""
  preprocessing_applied: ""
  n_rows: 0
  raw_sha256: ""
  raw_storage_path: ""       # outside Git, access-controlled
  retention_and_deletion: ""
  ethics_basis: ""
  approved_by: ""            # <adviser/ethics authority> — <YYYY-MM-DD>
  notes: ""
```

## Registered sources

*(none — Gate 1 not yet passed for any source)*

## Rules the register exists to enforce

1. **Rejection criteria** — reject leaked, scraped-without-permission,
   unverifiable, or license-incompatible material. The manuscript's named
   Kaggle/government sources are proposals, **not** proof of acquisition or
   permission.
2. **Raw storage** — raw sensitive files stay access-controlled and outside
   Git. Do not commit them "just this once" to make a run reproducible.
3. **User reports** — reports may enter training only through the approved,
   consented, admin-validated export documented in
   [`reports/README.md`](reports/README.md), and each accepted row keeps its
   source/report ID plus validation timestamp.
4. **Derived data manifest** — for every accepted row, the derived-data
   manifest must link it back to a `source_id` here plus the transformation
   version, without exposing message text.
5. **Immutability** — an entry, once approved, is edited only by appending a
   `revisions:` list. Never in place. Never silently.

## Also see

- [`LABEL_DEFINITIONS.md`](LABEL_DEFINITIONS.md) — what Ham/Spam/Scam mean in
  this project.
- [`LABELING_GUIDE.md`](LABELING_GUIDE.md) — how a labeller assigns them.
- [`reports/README.md`](reports/README.md) — the consented user-report export
  format.
- [`holdout/manifest.json`](holdout/manifest.json) — the permanent test set's
  own provenance record; the pattern here mirrors it.
- [`../ML_READINESS_PLAN_2026-09-19.md`](../ML_READINESS_PLAN_2026-09-19.md) —
  the full readiness plan and the gate this register clears.
