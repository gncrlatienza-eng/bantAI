# BantAI ML Pipeline — Full Documentation

**Sprint 2, Track B (AI/ML).** This is the complete, ordered record of how raw
SMS data becomes a deployed smishing classifier: every stage, every script,
every decision, every bug found and fixed along the way. It exists so the
process is reproducible and defensible in the thesis manuscript and defense —
not just "it works," but *why* it works and what was tried before it did.

For quick usage instead of full explanation, see [`README.md`](README.md). For
the exact class definitions, see
[`datasets/LABEL_DEFINITIONS.md`](datasets/LABEL_DEFINITIONS.md). For the API
contract, see [`../docs/api/classify.md`](../docs/api/classify.md).

---

## Pipeline overview

```
Raw sources (Kaggle, NTC, phone-inbox exports)
        │
        ▼
[1] Rule-based labeling ── scripts/build_dataset.py
        │  (every row gets: label, confidence, reason, language)
        ▼
[2] Human review & correction ── scripts/make_*_review_sheet.py + manual QA
        │  (AGREE/DISAGREE against LABEL_DEFINITIONS.md, corrections overlaid)
        ▼
datasets/labeled/bantai_labeled.csv  (the training set)
        │
        ▼
[3] Preprocessing ── preprocessing/  (NFKC + PII masking; SAME code path used
        │             at both training and inference time)
        ▼
[4] Model training ── training/train.py  (fine-tune XLM-RoBERTa-base)
        │
        ▼
models/xlm-roberta-smishing/  (the trained weights, git-ignored)
        │
        ▼
[5] Evaluation ── per-class metrics, confusion matrix, leakage check
        │
        ▼
[6] Inference service ── service/  (FastAPI: /health, /classify)
        │
        ▼
[7] Threshold routing ── service/classifier.py:route()
        │  (argmax → gap check → per-class threshold → bucket)
        ▼
NestJS backend consumes bucket + label over HTTP
```

Each stage is documented in order below.

---

## Stage 1 — Raw data sources

All under `datasets/bantAI-datasets/` (git-ignored; large, not portable).

| Source | File(s) | What it is | Trust level |
|---|---|---|---|
| Kaggle — `SPAM_SMS` | `Kaggle/SCAM_MESSAGES_COMBINED.csv` (filtered by `source` column) | "PH Spam + Marketing SMS" corpus | **Unverified.** Blanket-stamped `scam` at source, but included in the corpus specifically because it also carries legitimate marketing — the stamp cannot be trusted as-is. |
| Kaggle — `tagalog-sms` | same file | "Tagalog-SMS" corpus | **Unverified**, same reason. |
| Kaggle — `text-messages` | same file | "Philippine Spam/Scam SMS" (BwandoWando) | **Trusted** — a genuine scam-only corpus, per the manuscript's own description of why it was selected (p177). Still not perfectly clean — see the Bug History below. |
| NTC / CICC | `NTC/FOI-TEST-DATASET.csv` | Citizen-reported *suspected* scams (Freedom of Information dataset) | **Unverified.** People report legitimate marketing and telco notices as "suspicious" too, not just confirmed scams. |
| Raw phone exports | `Raw/PHONE-SMS-INBOX*.csv` (6 files, dated 2026-07-21 through 2026-07-24) | Real, unlabeled phone inbox exports (`sender`/`address`, `body`, `date_iso`/`timestamp`) | No source label at all — every row goes through the rule engine from scratch. |

**Collecting more data:** drop additional CSVs into `datasets/bantAI-datasets/Raw/`
with `body` (or `text`) and `sender`/`address` columns — no labels needed, the
rule engine assigns them. See "Bug History" below for why *duplicate* scam
templates add little value; different scam *types* are worth far more.

---

## Stage 2 — Rule-based labeling

**Script:** `scripts/build_dataset.py` (run: `cd ai && python scripts/build_dataset.py`)

This is the largest and most important script in the pipeline. It converts
every raw row into `(label, confidence, reason, language)` using transparent,
auditable rules — not a black box — so a human can review *why* each label was
assigned and correct it if wrong.

### 2.1 Obfuscation normalization

Before any rule runs, text is passed through `deleet()`:
- Leet-speak substitution (`0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, |→l, !→i`)
- Letter-spacing collapse (`"G C A S H"` → `"GCASH"`)

Every matcher runs against **both** the raw text and this normalized view, so
`"dep0sit"` still matches `deposit` while legitimately-numeric terms
(`"177bet"`, `"buy 1"`, `"50% off"`) still match correctly.

### 2.2 The rule cascade (`label_raw(sender, body)`)

Rules run in a fixed priority order — a message is labeled by the **first**
rule that fires. Order matters: PSA (safety-education) messages are checked
before any scam rule, or the classifier would learn that warning people about
scams *is* a scam.

1. **Anti-scam advisory (PSA) → Ham, high.** Telco/bank safety messages
   ("beware of SMS scams", "will never ask for your OTP"). Excluded when the
   message is itself an OTP delivery, since those must still face scam rules.
2. **Unambiguous gambling operators/mechanics → Scam, high.** Named illegal
   operators (`jili`, `177bet`, `e-sabong`, ...) and mechanics with no
   legitimate PH use (`slot bonus`, `deposit bonus`, `free chips`, ...).
3. **Non-Latin / punycode domain → Scam, high.** (`666рф.рф`, `xn--...`) —
   never legitimate in a PH SMS context.
4. **Brand impersonation → Scam, high.** Message names a brand (GCash, BDO,
   Globe, ...) but links to a domain that isn't that brand's own — checked
   against a curated `BRAND_DOMAINS` whitelist.
5. **Filter-evasion capitalization + loan bait → Scam, high.** ("You Are
   Qualified To Avail" style caps, paired with unsolicited credit-offer
   language.)
6. **Filter-evasion capitalization + any bait/phish/job/loan term → Scam, high.**
7. **Suspicious (non-whitelisted) link + bait/phish/job/loan term → Scam, high.**
8. **Phishing language + OTP/code mention → Scam, high.** ("verify your
   account" + "OTP"/"code" together — classic smishing.)
9. **Soft gambling vocabulary, corroborated → Scam, high.** Words legitimate
   telco promos also use ("panalo", "maglaro") only count with a second hit or
   a suspicious link — avoids false positives on real promos.
10. **Lottery/prize-win phrasing → Scam, medium.** ("you won", "claim your
    prize") — legit promos essentially never phrase things this way.
11. **OTP/verification code, no suspicious link → Ham, high.**
12. **Known government sender (NDRRMC, NTC, PAGASA, PHIVOLCS, ...) → Ham, high.**
13. **Telco/bank informational notice, no suspicious link → Ham, high.**
13a. **Institutional notice → Ham, high.** Every link in the message sits on a
    registrar-restricted domain (`.gov.ph`, `.edu.ph`). *Requires all links to
    be trusted, not merely one* — a scam name-dropping `doh.gov.ph` beside its
    own payload domain must not launder itself into Ham. *(Added 2026-07-29 —
    Bug History §8.)*
13b. **Transaction receipt → Ham, high.** "Thank you for paying ₱1150.00",
    delivery/tracking notices. Confirms something the user already did.
13c. **Public advisory → Ham, high.** Explicit advisory framing ("Public
    Service Advisory", "DOH COVID19 Advisory", "in compliance with the
    Bayanihan Act"). Unlike 13/13a this does *not* require a clean link,
    because official bodies legitimately link to their own Facebook page and
    `facebook.com` cannot be whitelisted outright (scams use it too). Its
    protection is **positional** — every gambling, phishing, impersonation,
    bait and job-scam rule already declined the message — plus a residual
    bait check.
14. **Job advertisement (legit recruitment), no suspicious link → Spam, high.**
15. **Promotional language → Spam.** High confidence if from a recognized
    brand sender, medium otherwise, **provided the link (if any) isn't
    suspicious.**
16. **Brand sender + any link, not suspicious → Spam, medium.**
17. **Promotional language + a link that fails the whitelist, from an
    unrecognized sender → Spam, low, reason `promo-unverified-link`.** *(Added
    2026-07-28 — see Bug History §3. Every rule above already had first crack
    at this message and found no scam signal, so "small business advertising
    on their own site" is more likely than "disguised scam".)*
18. **Short message, personal-looking sender, no link → Ham, high** (`personal-convo`).
19. **No link, not a brand sender → Ham, medium** (`no-link-default`).
20. **Everything else → Ham, low** (`unclassified-review`) — has a link or
    brand mention but matched no rule; explicitly the "I don't know" bucket
    that routes to human review.

### 2.3 Reconciling with the source's own label (`reconcile()`)

For pre-labeled sources (Kaggle, NTC), the rule verdict above is combined with
the corpus's own stamp:

| Rule says | Source trusted? | Result |
|---|---|---|
| Scam | either | **Scam, high** — rule and source agree |
| Ham, with PSA/OTP/gov/telco-info reason | either | **Ham, high, override:\<reason\>** — positive evidence beats the stamp |
| Spam, with promo/brand-link/job-ad reason | **untrusted only** | **Spam, high, override:\<reason\>** |
| PSA or telco-info reason | trusted | **Ham, high, override:\<reason\>** |
| anything else (no positive evidence either way) | either | **source's original stamp kept, confidence dropped to low**, reason `source-label-unverified` |

This is the fail-safe design: a source's "scam" stamp is **never silently
downgraded** without positive evidence — worst case, it stays Scam but at low
confidence, which routes it to human review instead of just trusting or
discarding it.

### 2.4 Language identification (`detect_language()`)

Counts *distinct* high-precision function words from two curated marker sets
(`TL_MARKERS`, `EN_MARKERS`). ≥2 distinct markers from each language → coded
as `taglish`. This runs independently of labeling — it's descriptive metadata
for reporting and future campaign clustering, **never an input to the model**
(confirmed in `training/dataset.py` — only `text` and `label` columns are read).

### 2.5 Outputs

Running `python scripts/build_dataset.py` from `ai/` produces:

| File | Contents |
|---|---|
| `datasets/labeled/bantai_labeled.csv` | **The training set.** `text, label, language, timestamp, source`. Deduplicated by exact raw text (one row per unique message). |
| `datasets/audit/bantai_labeled_full.csv` | Every occurrence, undeduplicated — includes the full `confidence`, `reason`, `source_label`, `sender` audit trail. |
| `datasets/audit/needs_review.csv` | Every `confidence == "low"` row from the final (deduplicated) set — the human-review queue. |
| `datasets/audit/label_changes.csv` | Every row where the rule's final label differs from the source's original stamp — the "the rules overrode this corpus" queue. |

Console output also reports full label/language/confidence/source breakdowns —
this is the fastest way to sanity-check a re-run before trusting it.

---

## Stage 3 — Human review & quality assurance

Rules are a starting point, not ground truth. Three review rounds have been
run so far, each targeting a different risk:

| Round | Script | Output | Rows | What it targeted |
|---|---|---|---|---|
| 1 | `scripts/make_review_sheet.py` | `datasets/audit/review_sheet.csv` | 238 (88 overrides + 150 stratified low-confidence) | Every row where rules overturned an *untrusted* corpus's own stamp, plus a general low-confidence sample |
| 2 | `scripts/make_trusted_review_sheet.py` | `datasets/audit/review_sheet_trusted.csv` | 120 | Low-confidence rows from the corpus previously assumed clean (`kaggle:text-messages`) |
| 3 | `scripts/make_promo_link_review_sheet.py` | `datasets/audit/review_sheet_promo_link.csv` | 94 (**all** of them, not a sample) | Every row touched by the brand-new `promo-unverified-link` rule (§2.2 step 17) — full population reviewed because the rule was unvalidated at scale |
| 4 | `scripts/make_confidence_review_sheet.py` | `datasets/audit/review_sheet_confidence.csv` | 100 (stratified, capped 12/rule) | **The blind spot.** Rounds 1–3 all sampled where the rules already admitted doubt; this samples *high- and medium-confidence* rows — 86% of the dataset, never previously checked |
| 5 | `scripts/make_new_batch_review_sheet.py` | `datasets/audit/review_sheet_new_batch.csv` | 44 (**all** of them) | Full population of low-confidence rows genuinely new in the 2026-07-29 raw-inbox top-up (105615 export) |
| 6 | `scripts/make_new_batch_review_sheet_2.py` | `datasets/audit/review_sheet_new_batch_2.csv` | 13 (**all** of them) | Same, for a second same-day raw-inbox export (171539) |
| 7 | `scripts/make_backlog_review_sheet.py` | `datasets/audit/review_sheet_backlog.csv` | 1,004 (**all** of them) | **The other blind spot.** Rounds 1–6 only ever reviewed newly-arrived batches; this is every low-confidence raw-inbox row from *any* earlier batch that no round had ever reached |

(`review_sheet_idn_fix.csv`, 4 rows, isn't a review round — it's a pre-filled
correction sheet for 4 rows a regex bug fix (§12) couldn't reach cleanly,
routed through the same overlay mechanism for auditability.)

Round 4 result: **87 agree / 13 disagree (87.0%)** — the confident bucket is
broadly sound, but the 13 disagreements clustered into three real rule bugs
(§10, §11, and more of §9) affecting well over a thousand rows. After those
fixes the rules reproduce **97%** of round 4's verdicts unaided.

Round 7 result: **660 agree / 341 disagree (65.9%)** — by far the lowest
agreement rate of any round, because it was the first to ever look at the
backlog rather than a fresh arrival. The disagreements clustered into three
real rule gaps (§14): 289 legitimate telco/e-wallet loyalty promos mislabeled
Ham, plus two previously-uncovered Scam categories (Messenger-link job scams,
credit-card ID-harvesting emails). After the §14 fix the rules reproduce the
backlog's verdicts natively for 184 of those 337 rows.

**Process, each round:** open the CSV (UTF-8-BOM encoded so Tagalog/emoji
render correctly in Excel), fill `verdict` (AGREE/DISAGREE), `correct_label`
if disagreeing, optional `notes` — judged against
[`datasets/LABEL_DEFINITIONS.md`](datasets/LABEL_DEFINITIONS.md). Corrections
are then overlaid onto `bantai_labeled.csv` by exact text match (with a
normalized-ASCII fallback for the handful of rows Excel corrupts on save — see
Bug History §5).

**Results so far:**

| Round | Agree | Disagree | Agreement rate | What it means |
|---|---|---|---|---|
| 1 (general) | 156 | 82 | 65.5% | High — but this round deliberately oversampled the riskiest rows (overrides + low-confidence), so this is NOT the overall dataset error rate |
| 2 (trusted corpus) | 115 | 5 | 95.8% | The "trusted" corpus is mostly clean, with a thin layer of real noise |
| 3 (new rule, full population) | 71 | 23 | 75.5% | Exposed a systematic rule gap, not 23 isolated misses — see Bug History §8. After the fix the rules reproduce **93.6%** of these verdicts unaided |
| 4 (high/medium confidence) | 87 | 13 | 87.0% | Audited the 86% of the dataset no earlier round could reach. Three rule bugs (§9–§11); rules now reproduce **97%** unaided |
| 5 (new batch, full population) | 34 | 10 | 77.3% | New raw-inbox top-up, low-confidence only |
| 6 (new batch #2, full population) | 10 | 3 | 76.9% | Second same-day top-up, same scope |
| 7 (backlog, full population) | 660 | 341 | 65.9% | Lowest of any round — see above. Three rule gaps (§14); rules now reproduce the backlog natively for 184/337 |

**Coverage so far:** 1,613 of 16,772 rows (9.6%) human-verified across seven
rounds. Deliberately risk-weighted, not random — rounds 1–3, 5–6 targeted
where the rules hesitated on new arrivals, round 4 audited where they were
confident, round 7 audited the backlog rounds 1–6 never reached. Between them
they cover the three failure modes: doubtful rules, confident-but-wrong rules,
and stale/unreviewed rows.

**Round 3 is the model for how these should be read.** A 75.5% agreement rate
was not "the reviewer disagreed with 23 rows" — 21 of the 23 shared one shape
(institutional notices), which pointed at a missing concept in the rules
rather than 21 individual mistakes. **Always cluster the disagreements before
patching rows**: if they share a shape, the rule is wrong and the fix
generalises to unreviewed data; if they don't, patch the rows. Round 3's fix
also corrected 50 rows from *earlier* rounds that the rules now handle
natively.

**IMPORTANT — a re-run gotcha:** running `build_dataset.py` regenerates
`bantai_labeled.csv` from **rules only** and silently discards every human
correction. Corrections are re-applied by
`scripts/apply_review_corrections.py`, which reads all three sheets and
overlays every DISAGREE verdict. **These two commands always run as a pair:**

```bash
python scripts/build_dataset.py
python scripts/apply_review_corrections.py    # never skip this
```

The overlay matches on exact text first, then falls back to printable-ASCII
comparison (Excel mangles curly apostrophes on save — Bug History §5). The
fallback is only accepted when it resolves to exactly one row; ambiguous
matches are reported, never guessed. It reports `applied` (label changed),
`already ok` (rules now agree natively), `unresolved` and `ambiguous` — all
four should be inspected after every rebuild.

---

## Stage 4 — Preprocessing (train == inference)

**Code:** `preprocessing/` (`normalization.py`, `masking.py`, `pipeline.py`)

```python
from preprocessing import preprocess
preprocess("Claim ₱5,000 at http://scam.ph code 483920")
# -> "Claim <AMOUNT> at <URL> code <OTP>"
```

Two steps, always in this order, and **always the same code path** at both
training time (`training/dataset.py`) and inference time
(`service/classifier.py`) — this identity is load-bearing; if it ever drifts,
the model sees different text at inference than it learned on.

1. **NFKC normalization** — folds full-width characters, look-alike Unicode,
   collapses whitespace.
2. **Regex PII masking** — replaces `<EMAIL>`, `<URL>`, `<PHONE>`, `<AMOUNT>`,
   `<OTP>` in that order. Tuned for Philippine formats (`₱5k` shorthand,
   `hxxp` de-fanged links, PH mobile/landline formats).

**Why this stage matters beyond privacy:** it also caused the most serious bug
found in this pipeline — see Bug History §1.

Unit tests: `tests/test_normalization.py`, `tests/test_masking.py`,
`tests/test_pipeline.py` (21 tests total, covering edge cases like decimals
that aren't URLs, obfuscated links, empty input).

---

## Stage 5 — Model training

**Code:** `training/` (`config.py`, `dataset.py`, `tokenizer.py`, `train.py`)

### 5.1 Architecture

- **Base model:** `xlm-roberta-base` — chosen specifically for its ~250,002
  -token SentencePiece multilingual vocabulary, which covers
  Tagalog/English/Taglish without needing a custom tokenizer.
- **Head:** 3-way sequence classification (`AutoModelForSequenceClassification`,
  `num_labels=3`), `id2label = {0: Ham, 1: Spam, 2: Scam}`.
- **Max sequence length:** 128 tokens (measured: median message is 45 tokens,
  only 1.6% of real messages hit the cap).

### 5.2 Data loading and the leakage fix (`training/dataset.py:load_split`)

1. Reads every `.csv`/`.json`/`.jsonl` in `datasets/labeled/`, **excluding**
   `sample.csv` (a 9-row hand-written format reference documented in
   `README.md` — not real data; see Bug History §2).
2. Runs every text through `preprocess()` (§4) — the model trains on masked
   text, never raw.
3. **Deduplicates on the masked text**, not the raw text (see Bug History §1
   for why this distinction is critical).
4. Stratified 80/20 train/validation split, fixed `seed=42`.

### 5.3 Hyperparameters (`training/config.py`)

| Parameter | Value |
|---|---|
| Learning rate | 2e-5 |
| Weight decay | 0.01 |
| Train / eval batch size | 16 / 32 |
| Epochs | 4 |
| Warmup ratio | 0.1 |
| Optimizer | AdamW (HuggingFace `Trainer` default) |
| Precision | fp16 on GPU |
| Model selection | best epoch by **macro-F1**, not accuracy or final epoch |
| Class-weighted loss | **enabled** (`config.class_weighted_loss`) |

**Class-weighted loss (added 2026-07-29).** The dataset is ~62% Ham / 21% Spam
/ 17% Scam. With the standard loss every mistake costs the same, so Ham errors
dominate purely by being more numerous and the model is rewarded for guessing
Ham whenever it is unsure. Each class is instead weighted by
`n_samples / (n_classes * class_count)` — on the current split that is
**Ham 0.539, Spam 1.422, Scam 2.260**, i.e. a Scam mistake costs **4.2× a Ham
mistake**.

Expected effect: Scam recall up (the class that matters — a missed scam
defrauds a user, a misfiled promo annoys them), Ham precision slightly down,
**macro-F1 up**, raw accuracy possibly down a little. The 0.90 Scam routing
threshold (§7) limits the downside: a more scam-eager model still routes its
low-confidence scam calls to Review rather than hiding them.

Implemented as a `Trainer` subclass overriding `compute_loss`; set
`class_weighted_loss = False` for standard unweighted cross-entropy. It
degrades safely — if any class is absent from the training split, weighting is
skipped rather than dividing by zero. Covered by 5 unit tests in
`tests/test_training_config.py` and smoke-tested end-to-end on CPU before
release.

### 5.4 Running it

**Locally** (`cd ai && python -m training.train`) — needs a CUDA GPU with
enough VRAM to hold weights + AdamW optimizer state + gradients
(~4.5 GB minimum for `xlm-roberta-base`; a 4 GB card is not enough).

**On Colab** (this project's actual training path, no local GPU available) —
see [`colab/README.md`](colab/README.md). Package: `colab/bantai_colab_package.zip`
(code + dataset, ~0.8 MB, rebuild with the script in that README whenever the
dataset changes); notebook: `colab/BantAI_Finetune_Colab.ipynb`. The notebook
hard-fails at its data-loading step if it detects any train/validation
overlap, specifically to prevent training on a stale, leakage-affected
package (see Bug History §1).

**Output:** `models/xlm-roberta-smishing/` (git-ignored) — `config.json`,
`model.safetensors` (~1.1 GB), `tokenizer.json`, `tokenizer_config.json`. The
inference service loads this directory automatically; `/health` reports
`model_ready: true` once it's present.

---

## Stage 6 — Evaluation

**Philosophy:** report **macro-F1**, not accuracy, as the headline number. Ham
is ~61% of the dataset, so a model that always guessed Ham would still score
~61% accuracy while being useless. Macro-F1 weights all three classes equally
and can't be gamed by majority-class bias.

**Per run:** classification report (precision/recall/F1 per class) +
confusion matrix, computed by re-creating the exact same validation split
(fixed seed) and scoring the saved model on it (notebook step 6).

### Results log

| Date | Macro-F1 | Accuracy | Scam recall | Notes |
|---|---|---|---|---|
| 2026-07-28 (run 1) | 0.9434 | 0.9540 | 0.9270 | **Inflated — do not cite.** Train/val leakage (Bug History §1); dataset also missing the promo-link fix. |
| 2026-07-28 (run 2, leakage-fixed) | 0.9325 | 0.9441 | 0.8978 | Honest number, superseded. Dataset has since changed further (§3 rule fix + review corrections). |
| 2026-07-29 (run 3, **final**) | **0.9438** | **0.9544** | 0.9284 | **Current installed model.** 15,728 rows (5 review rounds, 596 human-checked), class-weighted loss enabled, 0.00% leakage confirmed on this exact split before training. Legitimately exceeds run 1's inflated number, honestly this time. |

**Error analysis performed on run 2** (reading the actual misclassified
messages, not just the summary numbers) found that a meaningful share of
"model mistakes" were actually **label noise** — messages with zero scam
content stamped Scam by a source corpus, and legitimate small-business promos
stamped Ham by a rule gap. Both findings led directly to fixes (Bug History
§3, §4) rather than being written off as model weakness. This is the
recommended practice going forward: **before concluding the model needs more
data or tuning, read the actual misclassified examples** — the fix is often in
the labels, not the model.

Full run-3 breakdown (per-class P/R/F1, confusion matrix, bucket-level routing
results): [`docs/development/AI_MODEL_RESULTS.md`](../docs/development/AI_MODEL_RESULTS.md).

### Goal

**Target: macro-F1 ≥ 0.95, accuracy ≥ 0.96.** Not 99–100% — a 3-class,
multilingual, real-SMS task scoring that high is a leakage/noise red flag, not
a good result (this is literally how Bug History §1 was found). See the
literature comparison in [[bantai-argmax-vs-manuscript]] memory / conversation
history: the manuscript's own related-literature review does not report a
verified, leakage-checked accuracy for any comparable Philippine system
(SMSegurado's published 98.10–98.29% could not be verified as leakage-free —
same source-corpus family as ours). Framing for the thesis: match/exceed that
range through defensible means, and argue superiority on functional grounds
(explainability, campaign clustering, privacy masking) where the manuscript's
own RRL already establishes the comparison systems fall short.

### Not yet done

Nothing outstanding on evaluation as of run 3 — bucket-level (post-threshold)
results are now measured, see `docs/development/AI_MODEL_RESULTS.md` and
`scripts/evaluate_buckets.py`.

---

## Stage 7 — Inference service & threshold routing

**Code:** `service/` (`main.py`, `classifier.py`, `config.py`, `schemas.py`, `routers/`)

Full API contract: [`../docs/api/classify.md`](../docs/api/classify.md).
Summary:

- `GET /health` → `{status, model_ready}` — works even with no model present.
- `POST /classify` → masks PII, runs the model, returns `label` (raw
  prediction) + `scores` (full distribution) + `bucket` (routing decision).

**Routing (`classifier.py:route()`), three steps:**
1. **argmax** — highest-probability class wins.
2. **gap check** — if the winner doesn't lead the runner-up by ≥
   `review_margin` (default 0.15), route to `unknown` regardless of
   confidence — catches near-ties like 0.50/0.50/0.00.
3. **per-class threshold** — Scam ≥ 0.90 → `blocked`; Spam ≥ 0.60 → `spam`;
   Ham ≥ 0.50 → `safe`; anything failing its bar → `unknown`.

All four thresholds are environment-configurable (`BANTAI_AI_*`, see
`.env.example`) — tune once the model's real score distribution on live
traffic is observed, not by guessing.

Service tests (`tests/test_service.py`, `tests/test_routing.py`) use a
classifier pointed at an empty temp directory to test the "no model" contract,
rather than depending on whether a real model happens to be installed locally.

---

## Stage 8 — Explainability (SHAP indicator tags) — Sprint 3, WBS 3.1.2

**Status: dictionary contents drafted and unit-tested (2026-07-30); SHAP
integration itself is WBS 3.3.6, not yet done.**

**Code:** `service/indicator_tags.py` · **Tests:** `tests/test_indicator_tags.py` (14 tests)

The manuscript's Stage 6 (Explainability and Tip Retrieval) specifies SHAP
computing a Shapley value per token, then mapping the top contributing tokens
"through a curated dictionary into human readable indicator tags such as
'Prize Lure,' 'Suspicious URL,' or 'Brand Impersonation'" (manuscript also
names "Urgency Cue" elsewhere). The manuscript names examples, not an
exhaustive list — WBS 3.1.2 exists to decide the rest.

**Nine tags, drafted:**

| Tag | Source |
|---|---|
| Prize Lure | manuscript-named |
| Suspicious URL | manuscript-named (structural: shortener or non-whitelisted domain) |
| Brand Impersonation | manuscript-named (structural: named brand + suspicious link) |
| Urgency Cue | manuscript-named |
| Gambling Bait | grounded in `build_dataset.py`'s `GAMBLING_HARD`/`GAMBLING_SOFT` |
| Fake Job Offer | grounded in `JOB_SCAM` (incl. the §14 Messenger-link additions) |
| Unsolicited Credit Offer | grounded in `LOAN_BAIT` |
| Personal Info Request | grounded in the §14 `id-harvest-via-email` rule |
| OTP / Account Phishing | grounded in `PHISH` |

Deliberately **not** importing `build_dataset.py`'s lexicons directly — that
file decides a training *label* via a rule cascade (one winner, precedence
matters); this one *explains* a prediction to a user (multiple tags can apply
at once, no precedence). Sharing vocabulary is fine; sharing an import would
let one script's edits silently change the other's output.

**How it works today (pre-SHAP):** `tags_for_message(raw_text)` is a
standalone keyword/structural tagger — usable right now without any SHAP
dependency, and returns tags sorted by a placeholder weight (0.3 + 0.2/hit,
capped at 0.9). `to_indicator_dicts()` shapes the output to exactly what the
backend already expects (`POST /sms/:messageId/indicators`,
`[{tag: string, weight: number}]` — see `docs/api/sms.md`).

**3.3.6 (SHAP integration) — done 2026-07-30.** `service/explainer.py` wires
`shap` against the model for real per-token Shapley values, maps the top tokens
through `TAG_KEYWORDS` here, and normalizes each tag's summed Shapley mass to a
0–1 weight. The dictionary contents did not change — 3.3.6 consumes them.

**Why explanation is asynchronous.** True SHAP on a transformer needs hundreds
of masked forward passes per message — seconds on CPU, not milliseconds.
Inline it would break the manuscript's real-time interception requirement. So
classification returns immediately and the explanation is computed after the
fact, then attached via the backend's `POST /sms/:messageId/indicators`. That
endpoint already existing as a *separate* call is what makes this clean rather
than a workaround. `shap` is an optional dependency: when absent (or when
attribution fails on some input) `explain()` falls back to the deterministic
keyword tagger, and the result's `method` field records which path ran, so a
reader can always distinguish a real Shapley value from a heuristic.

**Measured against the real model, 2026-07-30** (CPU, run-3 checkpoint):

| Step | Time |
|---|---|
| Classification (+ embedding) | **~50 ms** |
| Real SHAP attribution | **13–26 s** |

SHAP is roughly **300–500× slower** than classification, which settles the
design question: asynchronous explanation is required, not merely tidy. The
`shap` path is verified working end to end — it produced correct tags and
sensible top tokens on real gambling, phishing and benign messages. Two bugs
were found doing that verification (Bug History §15, §16).

Client-side contract: [`../docs/api/explainability.md`](../docs/api/explainability.md) (WBS 3.2.2).

---

## Stage 9 — Campaign clustering — Sprint 3, WBS 3.3.4 / 3.3.5

**Code:** `service/embeddings.py`, `service/campaign.py` (fast path),
`scripts/embed_dataset.py`, `scripts/cluster_campaigns.py` (slow path)
**Tests:** `tests/test_campaign.py` (21), `tests/test_clustering.py` (15)
**Data flow spec:** [`../docs/api/campaigns.md`](../docs/api/campaigns.md) (WBS 3.2.1)

Implements the manuscript's Stage 5b. Classification and clustering are two
branches off **one** embedding, per the manuscript: the final-layer `[CLS]`
vector (768-dim) is pooled once and "reused by Stages 5a and 5b". So
`classify_full()` does a single forward pass with `output_hidden_states=True`
and returns both the class distribution and the embedding — computing them
separately would double inference cost and risk the two stages drifting into
different semantic spaces.

**Two speeds:**

| | Fast path (per message) | Slow path (offline batch) |
|---|---|---|
| Decides | join a *known* campaign | discover a *new* campaign |
| Method | cosine vs. active centroids | HDBSCAN over the buffer |
| Parameter | similarity ≥ **0.85** | `min_cluster_size` = **5** |
| Cost | microseconds | seconds–minutes |

Both parameters are the manuscript's. HDBSCAN comes from
`sklearn.cluster.HDBSCAN` (scikit-learn ≥ 1.3) rather than the standalone
`hdbscan` package — same algorithm, one less dependency, and sklearn was
already required for the train/val split. Clustering uses euclidean distance on
L2-normalized vectors, which is monotonically equivalent to cosine distance
(‖a−b‖² = 2 − 2·cos), so the two paths agree on what "similar" means.

**The AI service never writes to the database.** It decides the match and
returns it on `/classify`; the backend persists. Otherwise the dependency would
be circular (backend → AI `/classify`, AI → backend `/campaigns`) and schema
knowledge would be duplicated across two stacks.

**Retraining invalidates centroids.** Embeddings are only comparable within one
checkpoint's semantic space — after any retrain, old centroids are meaningless
against new embeddings, not merely shifted. Re-run both scripts after every
retrain (`embeddings.npz` records the `model_dir` it came from so a stale cache
is detectable). Re-clustering *alone* is cheap and safe to repeat any time: it
is pure math over cached embeddings and touches neither the model nor its
accuracy.

### First real run — 2026-07-30

Embedded all 16,772 messages with the installed run-3 checkpoint (20.3 min on
CPU, 13.8 msg/s), then clustered the Spam+Scam population (7,457 messages — Ham
excluded because personal conversation is not a campaign).

| Metric | Result |
|---|---|
| Clusters found | **221** |
| Messages grouped | 2,993 (40.1%) |
| Noise / one-offs | 4,464 (59.9%) |
| Largest cluster | 211 messages (2.8% of population) |
| Median cluster size | 8 |
| Scam-dominant clusters | 79 (755 messages) |
| Spam-dominant clusters | 142 (2,238 messages) |
| Mixed-label clusters | **5 of 221** |

**The manuscript's parameters hold up on real Philippine SMS.** Both failure
modes were checked for and neither occurred: no giant blob (the largest cluster
is 2.8% of the population, not 50%+) and no fragmentation (221 clusters for
7,457 messages, median size 8). `0.85` and `min_cluster_size = 5` can be cited
as validated rather than merely proposed.

**The strongest validation is the mixed-label count.** Clustering never sees
the Ham/Spam/Scam labels — it groups purely on embedding geometry. Yet only
**5 of 221 clusters** mix Spam and Scam messages. The embedding space separates
honest marketing from fraud on its own, which independently corroborates that
the classifier is learning a real semantic distinction rather than surface
keywords.

Discovered Scam campaign families are recognizable and coherent — Tagalog
gambling-registration blasts (`lucky6.auction`, `play6.tw`, `maswerte.city`),
"earn while watching YouTube" job scams, BDO account-restriction phishing,
and cashback/recharge lures. Spam clusters are similarly clean, dominated by
Globe/DITO promo template families.

**59.9% noise is expected, not a failure.** HDBSCAN labels a message noise when
it is not part of a *recurring* pattern; a one-off scam is still classified and
blocked normally by Stage 5a. Noise here means "no campaign yet" — those
embeddings stay buffered, and a campaign forms once 5+ similar messages arrive.

Regenerate with `scripts/cluster_campaigns.py` (seconds, over cached
embeddings). Cluster detail and centroids land in
`datasets/processed/campaign_clusters.json` (git-ignored — it embeds sample
message text).

---

## Bug history — found, fixed, and why each matters

Kept as a permanent record because *how* each was found is itself a
methodology point worth writing up, not just the fix.

### §1 — Train/validation leakage via masking (found 2026-07-28)

**Symptom:** suspiciously high Scam recall (92.7%).
**Cause:** `bantai_labeled.csv` deduplicates on *raw* text, but the model
trains on *masked* text. Gambling-blast scams differ only in their link
(`...libre 1q2w3e7.ca` vs `...1q2w3e8.ca`) — both mask to the identical
string. Two "different" rows survived dedup, then landed on opposite sides of
the train/val split: the model was tested on messages it had already
memorized. Measured: 13.7% of validation overlapped with training, **31.8%
for the Scam class specifically**.
**Fix:** `training/dataset.py:load_split` now deduplicates on masked text
before splitting. Checked for label conflicts first (only 9 of 13,584 unique
masked texts, safe to collapse). The Colab notebook now hard-fails if it
detects any leakage, so a stale package can never silently produce an inflated
number again.
**Impact:** macro-F1 0.9434 → 0.9325 (honest). A ~1-point drop, not a
collapse — evidence the model had genuinely learned the task, not just
memorized duplicates.

### §2 — Dummy data leaking into training

**Symptom:** none observed yet — caught by validating the training path
locally before the first Colab run, not by a bad result.
**Cause:** `training/dataset.py` globs `datasets/labeled/*.csv`, and
`sample.csv` — 9 hand-written example rows documented in `README.md` as a
*format reference* — sits in that directory.
**Fix:** loader now explicitly excludes any file starting with `sample`.

### §3 — Suspicious-link digit-domain bug

**Symptom:** 41 of 42 override-group disagreements in review round 1 followed
one exact pattern — gambling/investment scams downgraded from Scam to Spam.
**Cause:** `suspicious_link()` skipped any domain starting with a digit,
intended to avoid misreading a decimal amount ("20.00") as a domain. But
scam-gambling domains are *deliberately* digit-prefixed (`9y15.com`,
`1q2w3e7.ca`) specifically to dodge keyword filters — the guard was marking
the actual scam links as "not suspicious," letting a promo-language match
override the corpus's own Scam stamp.
**Fix:** guard now only matches true `digit.digit` amount strings
(`^\d+\.\d+$`), not any digit-led domain.

### §4 — Promotional messages with unrecognized links defaulting to Ham

**Symptom:** found via reading actual validation-set misclassifications (not a
review sheet) — real-estate/retail ads scoring as Spam by the model but
labeled Ham in training data. Confirmed against `"LOT FOR SALE...
facebook.com/BCQBlotforsale"`.
**Cause:** the promo rule only fired if the message had *either* no
suspicious link *or* a recognized big-brand sender — any small business
advertising via their own website/Facebook page had no path to Spam.
**Fix:** added rule §2.2 step 17 — promo language + unrecognized sender +
non-whitelisted link now returns Spam at low confidence (still flagged for
review) instead of falling through to Ham. Under human review as of this
writing (review round 3, full 94-row population, not sampled).

### §5 — Excel corrupting special characters on save

**Symptom:** 8 rows in a completed review sheet failed exact-text matching
against the training CSV during correction overlay.
**Cause:** saving the CSV in Excel silently mangled curly apostrophes into
U+FFFD replacement characters in a handful of multi-line cells.
**Fix:** correction-overlay scripts now fall back to a non-ASCII-stripped
match when the exact text isn't found; all 8 resolved uniquely, no data lost.
**Prevention:** save review sheets as "CSV UTF-8" explicitly, or edit in
Sheets/LibreOffice instead of plain Excel "CSV" save.

### §6 — `transformers` 5.x removed `Trainer(tokenizer=...)`

**Symptom:** would have been an immediate crash on the first Colab run.
**Cause:** the installed `transformers` version (5.14.1) removed the
`tokenizer=` argument entirely; it was renamed to `processing_class` in 4.46.
**Fix:** `train.py` updated; `requirements.txt` floor raised to
`transformers>=4.46`. Caught by validating the training path locally before
spending Colab time on it.

### §17 — Campaign matching ran against Ham, producing false campaign hits (2026-07-30)

**Symptom:** end-to-end verification against the real model showed the
personal message *"Hi, are we still meeting at 5pm later?"* matching a campaign
cluster at **0.9636** similarity.
**Cause:** `/classify` matched *every* message against the centroids. But
clusters are built from the **Spam+Scam population only** — personal
conversation is not a coordinated blast — so comparing a Ham message against
them is meaningless by construction. The specific collision: cluster 2 is a
short money-transfer-notification family, and a short personal message is
close to it in tone and length.
**Fix:** gate campaign matching on `label != "Ham"` in the classify router.
**Worth knowing:** the embedding space itself is fine — measured Ham-vs-Scam
pairs average **−0.008** similarity with only **0.8%** above 0.85. The failure
was matching against the wrong population, not a bad threshold.

### §16 — SHAP indicator vocabulary was English-only (found 2026-07-30)

**Symptom:** SHAP explained a real Tagalog gambling blast (*"Magparehistro
para sa libreng 7777, tumaya: lucky6.auction/…"*) and produced **no indicator
tag at all** — the user would see a blocked message with no reason given.
**Cause:** every term in the `Gambling Bait` vocabulary was English (`jili`,
`slots`, `cash out`, `deposit bonus`). The Tagalog verbs real blasts actually
use — `tumaya` (to bet), `magparehistro` (register), `deposito` — were absent.
**Fix:** added Tagalog gambling vocabulary.
**Why it matters beyond one message:** this is the *third* time the same
class of bug has appeared — `PROMO_TL` (§11) and `JOB_SCAM` (§8) were both
English-only lexicons missing their Filipino equivalents. **Every new lexicon
in this project should be checked for Tagalog/Taglish coverage before it
ships**, not after a real message exposes the gap.

### §15 — Substring token matching mislabeled Tagalog prefixes (found 2026-07-30)

**Symptom:** the same gambling blast was tagged **"Urgency Cue"** — confidently
wrong, which is worse than no tag.
**Cause:** the SHAP token→tag mapper tested `token in keyword` (substring). The
token `mag` — an extremely common Tagalog prefix — is a substring of the
keyword `mag-ingat`, so it scored as urgency language. Tagalog is heavily
agglutinative, so short prefixes (`mag`, `nag`, `pag`, `ka`) sit inside
unrelated keywords constantly; substring matching was never safe here.
**Fix:** whole-word matching (`_matches_keyword`), with a length-≥5 prefix
allowance so SentencePiece's mid-word splits still match (`gambl` → `gambling`),
and the minimum token length raised from 3 to 4.
**Lesson:** substring matching is a reasonable default for English and a
liability for agglutinative languages. Both fixes are locked in regression
tests using the exact tokens the real model produced.

### §14 — Round-7 backlog review surfaces two new Scam categories + a promo gap (found 2026-07-30)

**Symptom:** a full-population review of the 1,004 raw-inbox low-confidence
rows that every prior round had skipped (rounds 1–6 only ever reviewed
*newly arrived* batches, never the backlog) came back with a 34% disagreement
rate — 337 of 1,004 — far above the 3–13% seen in earlier rounds.
**Cause, three distinct gaps in one pass:**
1. **289 legitimate Globe/DITO/GCash loyalty-program messages** (raffle
   entries, rewards points, VoLTE/VoWiFi education) were defaulting to Ham.
   `PROMO_TERMS` was written around retail/telco-*offer* wording (§11 below),
   not loyalty-*program* wording — a different vocabulary entirely.
2. **Job scams routed through Facebook Messenger** (`m.me/...`) — these
   already tripped `suspicious_link()` correctly, but `JOB_SCAM` had no
   phrasing for "EARN WHILE AT HOME", "appointment setter", "homebased", or
   "copy-paste system", so `susp + JOB_SCAM` never fired.
3. **Credit-card ID-harvesting via email** (RCBC/EastWest/Citibank "FREE FOR
   LIFE ANNUAL FEE" blasts asking for 2 government IDs + a card photo mailed
   to a `gmail.com` address) — no link to flag (`gmail.com` is deliberately
   exempt from `suspicious_link`), and the ALL-CAPS styling isn't the
   *internal*-caps pattern `evasion_caps()` looks for (`CreDit`, not
   `CREDIT`), so nothing in the cascade caught it.
**Fix:**
1. Added DTI Fair Trade Permit citations and honest-marketing opt-out
   boilerplate (`no advisories?`, `to unsubscribe`, `stop txt`) plus common
   loyalty vocabulary (`raffle entries`, `rewards points`, `redeem rewards`,
   `volte`/`vowifi`) to `PROMO_TERMS` — chosen because scammers essentially
   never cite a real DTI permit number or offer a working STOP short-code, so
   these are general honest-promo signals, not one-off campaign names. Covers
   57% (168/293) of the promo backlog; the remaining 125 are individual
   brand/app names not worth chasing — mislabeling an honest promo as Ham
   instead of Spam doesn't affect scam-catching.
2. Added the missing phrasing to `JOB_SCAM`.
3. New standalone rule: `"government id" + ("frontface of" | "front face of")`
   → Scam, independent of caps styling — specific enough that no legitimate
   offer uses this pairing.
**Impact:** of the 337 disagreements, 184 are now caught by rules natively
(the correction overlay only needs to carry 153 forward). Human-reviewed
total across all rounds: 596 → 1,613 rows (9.6% of the corpus). **Lesson:
review the backlog, not just each new arrival** — rounds scoped to "what just
came in" systematically never re-examine older low-confidence rows, and nearly
a third of this backlog turned out to be wrong.

### §13 — Word-boundary matcher missing plural variants (found 2026-07-30)

**Symptom:** two rows the §14 backlog review flagged had exact rule vocabulary
already present, but didn't match — `"lucky winner"` (singular) didn't fire on
`"one of our lucky winners"`, and `"cash loan"` didn't fire on `"NEED CITIBANK
CASH LOANS?"`.
**Cause:** the matcher's word-boundary regex correctly rejects partial-word
matches (`"bet"` inside `"alphabet"`), but the same boundary blocks the plural
form of an otherwise-exact phrase.
**Fix:** added the plural variants (`"lucky winners"` to `WIN_SCAM`, `"cash
loans"` to `LOAN_BAIT`) rather than changing the matcher to auto-pluralize
everything — a global change to matching behavior needs its own full corpus
re-scan to trust, which two isolated misses didn't justify.

### §12 — Anti-scam-advisory apostrophe miss + Lazada shortlink not whitelisted (found 2026-07-30)

**Symptom:** a DSWD/SSS ayuda anti-scam advisory ("Pag may link, SCAM 'YAN!
'WAG MAG-CLICK...") was labeled Scam via `phishing+action`, and two genuine
Lazada security notices ("NEVER SHARE YOUR OTP", "Your PASSWORD has been
CHANGED") were labeled Scam via `brand-impersonation:lazada`.
**Cause:** `PSA` already contained `"scam yan"`, but the message read `"SCAM
'YAN!"` — the apostrophe breaks the literal substring match, same root cause
as §13. Separately, Lazada's real short-link domain `lzd.co` was never added
to `OFFICIAL_DOMAINS`, so any Lazada notice using it looked like an off-brand
link.
**Fix:** added `"scam 'yan"` / `"scam 'iyan"` to `PSA`, and `lzd.co` to
`OFFICIAL_DOMAINS`.
**Also found in the same pass:** `IDN_RE` (the non-Latin-domain detector) was
matching peso amounts with a decimal point (`₱16054.5.`) as fake domains,
mislabeling real GRAB OTP deliveries and TikTok billing notices as Scam.
**Fix:** added a negative lookahead so the "TLD" segment can't start with a
digit — a real domain's label never does, but a currency amount's does. 7
rows fixed corpus-wide. Left 4 Thai-language retail-promo rows (still
matching via a different angle — Thai date abbreviations use periods too)
corrected directly through the review-sheet pipeline instead of further
regex surgery for a script this thesis doesn't target.

### §11 — Promo lexicon blind to telco/bank offer phrasing (found 2026-07-29)

**Symptom:** review round 4 — three obvious marketing messages labeled Ham via
`no-link-default` ("Enjoy 3 GB/day ... for P115!", "Here's FREE 150MB for
surfing", "Fund your goals with CIMB Personal Loan! Apply...").
**Cause:** measured directly — **zero** promo terms matched any of the three.
`PROMO_TERMS` was written around retail and real-estate wording ("% off",
"flash sale", "pre-selling", "sqm", "open house"); an SMS selling a data bundle
or a loan uses none of it. Telco/bank offers are the highest-volume Spam shape
in the corpus, so the gap was expensive.
**Fix:** added telco/bank offer phrasing (`for only p`, `valid for`, `as low
as`, `apply now/using/thru`, `get up to`, `enjoy unli`, `data promo`, ...).
**Impact:** Spam rose 3,217 → 3,771 and Ham fell 9,432 → 8,986 — the single
largest distribution shift of any fix, i.e. several hundred marketing messages
had been training the model to call advertising "legitimate".

### §10 — Brand-impersonation rule blind to campaign infrastructure (2026-07-29)

**Symptom:** review round 4 — **7 of 13 disagreements were
`brand-impersonation`**, all legitimate marketing marked Scam. A ~37% error
rate on a *high-confidence* rule covering ~600 rows.
**Cause:** the rule fired whenever a message named a brand and no link sat on
that brand's own domain. Real Philippine brands break that constantly: Shopee,
Globe and UnionBank blast campaigns through `bit.ly`, DITO links to its lender
partner `juanhand.com`, Maya uses its own shortener `mayaph.co`, and PayMaya
links to `paymaya.com` — none of which were whitelisted.
**Fix:** impersonation now requires *evidence of deception*, not merely an
off-domain link — the brand name appearing inside the linked domain
(`mayabank.tw`), bait/phishing/prize language, a throwaway TLD, **or** the
absence of any promotional wording. Plus `SHORTENERS`/`SCAMMY_TLDS` sets and
the missing brand domains.
**Two regressions this fix caused, and how they were caught:** re-scoring the
completed sheets after each edit (not just eyeballing the change) showed the
first version waving through `"Lazada: Your PASSWORD has been CHANGED"` and
`"LBC: your order was unsuccessfully delivered"` — real phishing that carries
no promo language. Hence the "no promotional wording ⇒ still deceptive" clause
and new `PHISH` patterns. A second pass then showed genuine OTP messages
flipping to Scam because `"if you did not request this"` had been added to
`PHISH` — that phrase is standard boilerplate on *legitimate* security
notices, and was removed. **Lesson: after every lexicon change, re-score all
completed review sheets — a fix that improves one cluster routinely breaks
another, and only the full re-score surfaces it.**

### §9 — PSA and advisory lexicons too narrowly phrased (found 2026-07-29)

**Symptom:** found by spot-checking *medium-confidence* rows — a category no
review round had ever sampled. Two legitimate Ham messages labeled Spam:
a Globe fraud warning ("New SCAM Alert! Watch out for unauthorized SIM card
dealers...") and a service-downtime notice ("checking and redemption of Globe
Rewards points **will be unavailable**").
**Cause:** the `PSA` lexicon was phrased almost entirely around OTPs and links
("never share your OTP", "don't click links"), so a fraud warning on any other
topic matched nothing and fell through to the brand-link Spam rule. Separately
`ADVISORY` had `"we would like to inform you"` but not the contraction
`"we'd like to inform"` — a one-apostrophe miss.
**Fix:** broadened `PSA` with warning-style phrasing (`scam alert`, `fraud
alert`, `watch out for unauthorized`, `huwag maniwala`, ...) and `ADVISORY`
with the contraction plus service-availability phrasing (`will be unavailable`,
`temporarily unavailable`).
**Why it matters beyond two rows:** it proved the high/medium-confidence
bucket — 86% of the dataset — can hide systematic errors that no previous
review round was capable of detecting, since rounds 1–3 sampled only where the
rules had already flagged doubt. That gap is what review round 4 exists to
close. **Lesson: sample where the rules are *confident*, not only where they
hesitate.**

### §8 — Whitelist had no concept of institutional domains (found 2026-07-29)

**Symptom:** review round 3 returned 23 disagreements out of 94 (75.5%
agreement). 21 of the 23 shared one shape: **institutional informational
notices** labeled Spam — DOH COVID advisories, BSP consumer-rights notices,
DLSL school announcements to parents, the PLDT 8-digit landline migration,
Ninja Van delivery notices, a Palawan Express payment receipt.
**Cause:** `OFFICIAL_DOMAINS` is a hand-curated list of ~35 *commercial*
brands. It had no representation of government (`doh.gov.ph`, `bsp.gov.ph`),
schools (`dlsl.edu.ph`), or service domains (`pldthome.com`, `nnj.vn`). Those
links therefore counted as "suspicious", which disqualified every Ham anchor
(each required `not susp`), so the messages fell through to the
`promo-unverified-link` rule from §4 — words like "visit", "reserve" and
"promo runs" were enough to trip the promo lexicon. The §4 rule was not itself
wrong; it was catching what the whitelist gap dropped on it.
**Fix, three parts:**
1. `TRUSTED_TLD_SUFFIXES` — `.gov.ph` / `.edu.ph` are *registrar-restricted*
   in the Philippines (dotPH requires agency endorsement or CHED/DepEd
   accreditation to register one), so a link on one is strong positive
   evidence of a real institution rather than an ad-hoc whitelist patch. Plus
   the specific service domains above added to `OFFICIAL_DOMAINS`.
2. Three new Ham anchors — `institutional-notice` (all links restricted-TLD),
   `transaction-receipt`, `public-advisory` (rules 13a–13c).
3. Two genuine Scams the round also surfaced: the `PIN77` gambling operator
   (plus the "21+ only / keep it fun" age-gate boilerplate offshore betting
   blasts wear to look licensed) and **Tagalog work-from-home bait** — `JOB_SCAM`
   was English-only, so "KUMITA NG MALAKI HABANG NASA BAHAY LANG" had no rule
   to catch it. *This is the same language-coverage gap `PROMO_TL` fixed for
   Spam — worth checking for in every future lexicon.*

**Impact:** rules now reproduce 93.6% of round 3's verdicts unaided (from
75.5%), and 50 corrections from earlier rounds became unnecessary because the
rules now get them right natively. Six rows remain rule-mismatched and are
carried by the correction overlay — they are genuinely borderline (a school
forwarding a vendor's sale; an expiring-promo telco notice), not rule bugs,
and were deliberately left alone rather than overfitting rules to single rows.

### §7 — Checkpoint bloat inflating the downloaded model to 7 GB

**Symptom:** first trained-model download was 7 GB instead of the expected
~1.1 GB.
**Cause:** `Trainer`'s default `save_strategy="epoch"` keeps a full checkpoint
— model weights **and** AdamW optimizer state (~3.4 GB each for this model) —
per epoch, indefinitely. Only the single final `trainer.save_model()` call is
ever actually used for inference.
**Fix:** added `save_total_limit=1` to `TrainingArguments`. Future downloads
will be the correct ~1.1 GB.

---

## Known limitations (for the manuscript's limitations section)

*Updated 2026-07-30 after review round 7 (backlog) and the §12–§14 rule
fixes — dataset is now 16,772 rows (Ham 9,315 / Spam 4,788 / Scam 2,669),
up from the 15,728-row snapshot the run-3 model (still the currently
installed one) was trained on. Not yet retrained on this version — see the
Results log above for what's actually deployed.*

- **Label quality is majority rule-based, not human-verified.** 1,613 of
  16,772 rows (9.6%) have been human-checked across 7 review rounds — up
  sharply from 3.8% after round 7 reviewed the backlog of older low-confidence
  rows that earlier rounds had skipped (they only ever covered newly-arrived
  batches). The dataset should still not be treated as ground-truth-clean —
  treat model metrics as measuring agreement with the rule engine, moderated
  by the review rounds above.
- **Tagalog Spam grew from 21 to 41 rows** after the §14 promo-vocabulary fix
  (loyalty-program phrasing like "Mag-redeem" now recognized), but is still
  thin relative to the corpus. Legitimate Filipino-language marketing SMS
  remains underrepresented in every source corpus used — a *data* gap more
  than a rule gap at this point.
- **Scam examples lean even more heavily on gambling** — 1,321 of 2,669 Scam
  rows (49.5%, up from 42.4%) trace to a gambling-flavored rule, since round
  6's new batch added more of that template family while the §14 fixes added
  comparatively few non-gambling Scam rows (job-scam-via-Messenger,
  credit-card ID-harvesting). Those two *are* genuinely new categories now
  represented for the first time, but the underlying skew is still the most
  actionable gap if more data collection is possible — loan-shark texts have
  12 rows total, and there is no dedicated romance-scam or fake-courier
  category at all.
- **651 rows (3.9%) have `language = undetermined`** — purely a reporting/
  metadata limitation (short/garbled/foreign-language text the detector
  can't confidently classify); confirmed to have zero effect on training,
  since the training loader never reads the `language` column.

---

## Reproducibility — full pipeline from scratch

```bash
cd ai
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r requirements.txt

# Stage 1-2: rule-based labeling  (ALWAYS run these two as a pair)
python scripts/build_dataset.py             # rules -> labeled/ + audit/
python scripts/apply_review_corrections.py  # overlay human verdicts back on

# Stage 3: human review (manual step — open the CSVs, fill verdict/correct_label,
#          then re-run apply_review_corrections.py)
python scripts/make_review_sheet.py            # general sample
python scripts/make_trusted_review_sheet.py    # trusted-corpus sample
python scripts/make_promo_link_review_sheet.py # new-rule full population
python scripts/make_confidence_review_sheet.py # high/medium-confidence blind spot
python scripts/make_backlog_review_sheet.py    # raw-inbox backlog, full population

# Stage 5: training (needs a GPU -- see colab/README.md if none available locally)
python -m training.train
# -> models/xlm-roberta-smishing/

# Stage 7: run the service
uvicorn service.main:app --port 8001
# GET /health  -> {"status": "ok", "model_ready": true}

# Stage 9: campaign clustering (re-run BOTH after any retrain -- see Stage 9)
python scripts/embed_dataset.py       # slow: one forward pass per message
python scripts/cluster_campaigns.py   # fast, re-runnable over cached embeddings

# Verify everything
python -m pytest tests/ -q   # 123 tests: masking, normalization, pipeline,
                              # routing, service, training config, indicator
                              # tags, explainability, campaign matching,
                              # clustering stability
```

---

## File reference

| Path | Purpose |
|---|---|
| `scripts/build_dataset.py` | Stage 1-2: raw sources → labeled dataset |
| `scripts/make_review_sheet.py` | Review round 1 (general risk sample) |
| `scripts/make_trusted_review_sheet.py` | Review round 2 (trusted-corpus sample) |
| `scripts/make_promo_link_review_sheet.py` | Review round 3 (new-rule full population) |
| `scripts/make_confidence_review_sheet.py` | Review round 4 (high/medium-confidence blind spot) |
| `scripts/make_new_batch_review_sheet.py` | Review round 5 (new raw-inbox top-up, full population) |
| `scripts/make_new_batch_review_sheet_2.py` | Review round 6 (second same-day top-up, full population) |
| `scripts/make_backlog_review_sheet.py` | Review round 7 (raw-inbox backlog never previously reviewed, full population) |
| `scripts/evaluate_buckets.py` | Bucket-level (post-threshold) evaluation using the real production `route()` |
| `scripts/apply_review_corrections.py` | **Re-applies all human corrections after any rebuild — always run with `build_dataset.py`** |
| `datasets/LABEL_DEFINITIONS.md` | Ham/Spam/Scam definitions + routing/threshold reference |
| `datasets/LABELING_GUIDE.md` | Practical labeling guidance for human reviewers |
| `datasets/labeled/bantai_labeled.csv` | The training set (git-ignored, regenerable) |
| `datasets/audit/*.csv` | Full audit trail, review queues, review sheets |
| `preprocessing/` | NFKC + PII masking (shared by training and inference) |
| `training/` | Model config, dataset loading, tokenizer, training loop |
| `service/` | FastAPI inference service |
| `service/indicator_tags.py` | SHAP indicator tag dictionary (Sprint 3, WBS 3.1.2) |
| `service/explainer.py` | SHAP attribution → indicator tags (WBS 3.3.6) |
| `service/tips.py` | Scam awareness card lookup (WBS 3.3.7) |
| `service/embeddings.py` | Shared 768-dim [CLS] embedding extraction |
| `service/campaign.py` | Cosine campaign matching, fast path (WBS 3.3.4) |
| `scripts/embed_dataset.py` | One-off embedding pass over the labeled dataset |
| `scripts/cluster_campaigns.py` | Offline HDBSCAN re-clustering (WBS 3.3.5) |
| `colab/` | Colab notebook + package + instructions (no local GPU path) |
| `tests/` | 41 pytest tests across every module above |
| `models/` | Trained weights output (git-ignored) |
| `../docs/api/classify.md` | ML service API contract (consumed by the NestJS backend) |
