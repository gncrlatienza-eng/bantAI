# bantAI ML Readiness Plan

**Date:** 2026-09-19  
**Status:** **NO-GO for fine-tuning claims, model release, and automatic blocking**  
**Scope:** XLM-RoBERTa SMS classification, evaluation, deployment, and retraining. Campaign clustering is out of scope except where the manuscript incorrectly couples it to the classifier.

## 1. Evidence boundary and current decision

This plan separates **observed repository evidence** from the **method proposed for the next valid run**. Historical JSON reports and manuscript descriptions are not proof that a reproducible model exists in this checkout.

| Observed on 2026-09-19 | Consequence |
|---|---|
| [`models/`](models/) contains only `.gitkeep`; no checkpoint, tokenizer, or `version.json` exists. | `/classify` cannot provide trained-model inference. No trained/deployed-model claim is supportable. |
| [`datasets/labeled/sample.csv`](datasets/labeled/sample.csv) is only a nine-row format example and is explicitly excluded by [`training/dataset.py`](training/dataset.py#L28). | The effective fine-tuning corpus in this checkout is **zero rows**, not nine rows and not an estimated 30–50 messages. |
| The four files under [`datasets/augmented/`](datasets/augmented/) are run summaries. They record counts but contain no message rows, and state that generated rows were not merged. | They cannot be converted or “materialized” into a corpus. Synthetic data must never be reconstructed from summary statistics. |
| [`datasets/holdout/manifest.json`](datasets/holdout/manifest.json) exists, but its referenced `holdout.csv` is absent. The manifest also warns that older checkpoints were exposed to the pre-split pool. | The permanent test set cannot be integrity-checked or rerun here; historical holdout metrics are not currently reproducible. |
| [`training/config.py`](training/config.py#L41) defines a plausible configuration, while [`training/dataset.py`](training/dataset.py#L60) implements an 80/20 development split and excludes declared synthetic origins from validation. | The pipeline design is partly sound, but configuration presence is not evidence of training. |

**Non-negotiable decision:** do not train, tune thresholds, report performance, promote a candidate, or describe the classifier as completed until Gates 1–8 below pass. The service must retain its unavailable/caution-only behavior; no fallback may automatically block a message.

## 2. Method lock before data work

Track B and the adviser must approve a one-page protocol amendment resolving these manuscript/code conflicts before results are generated:

1. **Learned labels:** implementation trains `Ham / Spam / Scam`; `Unknown` is a low-confidence routing state, not a learned class. Document the lossless participant-facing mapping instead of claiming the manuscript's `Likely Smishing / Suspicious / Unknown` training head. See [`training/config.py`](training/config.py#L9), [`service/classifier.py`](service/classifier.py#L38), and manuscript pp. 165–166, 180–181.
2. **Inference location:** choose either the current privacy-minimized remote service or a real on-device implementation. Do not retain both as simultaneous claims. Manuscript p. 224 says Android is preloaded with XLM-RoBERTa, HDBSCAN, and SHAP; the repository currently has no Android model/tokenizer/runtime artifact. See the current discrepancy record in [`MANUSCRIPT_IMPLEMENTATION_ALIGNMENT_2026-09-16.md`](../docs/development/MANUSCRIPT_IMPLEMENTATION_ALIGNMENT_2026-09-16.md#L49).
3. **Training schedule:** code defaults to four epochs; manuscript p. 235 specifies three. Prefer a predeclared maximum plus early stopping on development data, then update both code and manuscript to the approved protocol. Never choose the rule after viewing test results.
4. **Retraining origin:** code starts candidates from `xlm-roberta-base`; manuscript p. 235 says deployed weights. A fixed-base run over a complete versioned snapshot is the more reproducible default. If continual fine-tuning is retained instead, its accumulated-drift risk and recovery procedure must be evaluated and documented.
5. **Promotion semantics:** code allows a 0.01 macro-F1 and Scam-recall decrease and always uses an exact paired test; manuscript p. 236 requires no F1 decrease and uses continuity-corrected McNemar except for small discordant counts. Predeclare one justified rule and obtain adviser approval.
6. **Feedback intake:** current code requires separately consented offline exports; manuscript describes automatic appending of validated reports. The privacy-preserving implementation should be reflected in the manuscript unless new ethics approval authorizes another flow.

Source manuscript: [Manuscript_BantAI_Thesis.pdf](../../Manuscript_BantAI_Thesis.pdf), exact local path `C:\Users\MJ De Castro\OneDrive\Documents\Reymark_School\Thesis\Manuscript_BantAI_Thesis.pdf` (especially pp. 165–167, 176–178, 180–181, 224, and 233–236).

## 3. Data governance and provenance — Gate 1

Create an immutable data-source register before importing any message. For every source record: source ID; title and citation/URL; provider; acquisition date; license or written permission; allowed research/deployment use; collection method; original label meaning; language/domain; timestamps and sender fields present; privacy risks; preprocessing performed; row count; and SHA-256 of the untouched source file.

- Reject leaked, scraped-without-permission, unverifiable, or license-incompatible material. The manuscript's named Kaggle/government sources are **proposals**, not proof of acquisition or permission.
- Keep raw sensitive data access-controlled and outside Git. Record who can access it, retention/deletion rules, and ethics/consent basis.
- User reports may enter training only through an approved, consented, admin-validated export with source/report IDs and validation timestamps. Preserve the privacy boundary documented in [`datasets/reports/README.md`](datasets/reports/README.md).
- Preserve raw-source hashes and produce a derived-data manifest linking every accepted row to its source and transformation version without exposing message text.

**Gate 1 passes when:** the adviser/ethics authority accepts the register and every included source has documented lawful use.  
**Stop immediately if:** permission, provenance, consent, or safe storage is unresolved.

## 4. Label protocol and quality assurance — Gate 2

Use [`datasets/LABEL_DEFINITIONS.md`](datasets/LABEL_DEFINITIONS.md) and [`datasets/LABELING_GUIDE.md`](datasets/LABELING_GUIDE.md) as drafts, then freeze a versioned annotation manual with Filipino examples and boundary cases: legitimate OTP/transaction notices, lawful marketing, impersonation, credential/payment theft, mixed-content messages, and insufficient-context cases.

1. Train annotators on a calibration batch without model predictions.
2. Independently double-label a prospectively defined quality sample, oversampling high-risk/borderline cases without changing evaluation prevalence.
3. Report agreement by class (Cohen's kappa plus raw agreement); adjudicate disagreements by written rule and retain both original labels and the final decision.
4. Run automated QA for missing text, invalid labels, exact duplicates, masked-text duplicates, conflicting labels, language/source metadata, and impossible timestamps.
5. Change the current `setdefault` behavior in [`training/dataset.py`](training/dataset.py#L83) so conflicting labels for the same masked text fail loudly and generate a review report.
6. Keep synthetic rows explicitly marked by generator version, seed template, reviewer, and approval. They may supplement **training only**; never validation, calibration, or test data. Cap/use policy must be predeclared after real-corpus composition is known.

**Gate 2 passes when:** the annotation manual, agreement report, adjudication log, and clean label audit exist.  
**Stop immediately if:** conflicts are silently discarded, model outputs influence gold labels, or synthetic rows contaminate evaluation.

## 5. Leakage-safe split design — Gate 3

Freeze splits only after preprocessing-equivalent deduplication. Group together exact duplicates, messages that collapse to the same masked text, synthetic variants and their seeds, and messages from the same campaign/template. Where metadata permits, also prevent sender/source/time-family leakage.

- **Training:** real approved rows plus separately marked, reviewed synthetic augmentation.
- **Development validation:** real rows only; used for epoch/model selection, class weighting, calibration, and threshold selection.
- **Locked release test:** real rows only; never used for training, prompt/template creation, threshold selection, or routine debugging. Access must be logged and limited to formal release decisions.
- Preserve class, language, and source representation without splitting a group. Predeclare treatment of rare strata rather than duplicating rows.
- Write split manifests containing method/version, seed, group definition, counts by class/language/source, file hashes, and overlap checks. Restore or recreate `datasets/holdout/holdout.csv` only from an authorized canonical source, then verify it against [`datasets/holdout/manifest.json`](datasets/holdout/manifest.json); never fabricate it from evaluation summaries.

The manuscript's 80:20 train/validation statement (pp. 176–178) and permanent test-set statement (pp. 233–236) must be rewritten into one unambiguous three-part protocol. Proportions and minimum evidence targets must be justified from the acquired corpus and intended error bounds—not invented now.

**Gate 3 passes when:** an independent overlap audit returns zero cross-split groups and all split hashes are frozen.  
**Stop immediately if:** any test row, template, masked duplicate, or synthetic relative appears in training/development data.

## 6. Reproducible fine-tuning — Gate 4

Lock a run specification before execution:

- base checkpoint revision and hash (`xlm-roberta-base` unless the approved protocol changes it);
- exact dataset/split/preprocessing hashes and code commit;
- `Ham=0, Spam=1, Scam=2`, tokenizer revision, max length, optimizer, learning-rate schedule, class-weight calculation, batch/gradient settings, maximum epochs, early-stopping rule, random seeds, hardware, library/CUDA versions, and deterministic settings;
- model-selection metric: development macro-F1 with a predeclared Scam-recall safety constraint; accuracy alone is insufficient;
- repeated predeclared seeds or another approved uncertainty procedure, with all runs reported rather than selecting an attractive seed;
- complete learning curves, warnings, elapsed time, and failed runs.

The existing defaults in [`training/config.py`](training/config.py) are a starting point, not validated hyperparameters. Hyperparameter search must use development data only. The locked test set stays unopened.

**Gate 4 passes when:** a clean machine/Colab can reproduce the selected development result from the run specification.  
**Stop immediately if:** a dependency/model revision floats, a seed/result is cherry-picked, or test results alter training choices.

## 7. Calibration and routing — Gate 5

Softmax confidence is not automatically calibrated. On development/calibration data only:

1. measure reliability by class (calibration curve and a declared calibration-error metric);
2. fit a predeclared calibration method if necessary and serialize it with the model;
3. select per-class thresholds and the top-two margin against an adviser-approved cost matrix emphasizing Scam misses and harmful Ham-to-Scam actions;
4. report coverage: how many messages route to Safe, Spam, Scam, and `Unknown`, including language/source slices;
5. freeze thresholds before the release test.

The values in [`service/config.py`](service/config.py#L31) are implementation defaults, not proven operating points. Automatic blocking remains disabled until the release test demonstrates the predeclared false-positive safety criterion and explicit user-control/ethics requirements are satisfied.

**Gate 5 passes when:** calibration artifacts, chosen operating points, rationale, and frozen configuration are versioned.  
**Stop immediately if:** thresholds are selected on the locked test set or chosen only to maximize headline F1.

## 8. Release evaluation and safety gates — Gates 6–7

Run the frozen candidate exactly once per approved release decision on the integrity-checked release test. Report counts and uncertainty, not only percentages:

- confusion matrix; accuracy; macro and per-class precision, recall, and F1; Scam false-negative rate; Ham/legitimate-message false-positive and Ham-to-Scam rates;
- calibration and routing coverage;
- language (English/Tagalog/Taglish), source, message length, URL/no-URL, obfuscation, and campaign/time slices where sample support is sufficient; mark unsupported slices as inconclusive;
- blinded qualitative error analysis with privacy-safe examples and no post-test relabeling unless the entire correction/re-evaluation procedure is disclosed.

For later candidates, compare incumbent and candidate on the **same rows** using a predeclared paired test. Promotion requires all of the following:

1. the candidate clears standalone minimum safety/utility targets approved before training;
2. macro-F1 is non-inferior within an adviser-approved, justified margin;
3. Scam recall/FNR is non-inferior within an independently justified safety margin;
4. Ham-to-Scam harmful false positives do not regress beyond their approved margin;
5. the paired comparison supports benefit rather than chance/regression;
6. no material language/source slice regression is hidden by the aggregate;
7. a human reviews transition counts and representative regressions.

[`retraining/promotion.py`](retraining/promotion.py) already implements macro-F1, Scam-recall, and paired-disagreement checks, but its hard-coded 0.01 tolerances are not research justification and it does not gate Ham-to-Scam errors. The current retraining evaluator also uses a candidate snapshot validation split rather than the absent permanent test; see [`retraining/pipeline.py`](retraining/pipeline.py#L258).

**Gate 6 passes when:** the candidate has a complete, signed evaluation packet.  
**Gate 7 passes when:** every safety gate passes and Track B, Track A, and the adviser sign the release decision.  
**Stop immediately if:** the test set fails integrity checks, any required slice is silently omitted, or a safety regression is averaged away.

## 9. Artifact registry and deployment — Gate 8

Every releasable version must be an immutable bundle containing:

- model weights, `config.json`, tokenizer/SentencePiece files, label map, calibration object, and frozen thresholds;
- `version.json` with model/data/split/code hashes and parent model version;
- run configuration, environment lock, training logs, metrics, confusion matrix, calibration report, raw prediction IDs (no message text), model card, known limitations, and approval record;
- deployment target, activation time, rollback target, health-check evidence, and post-release monitoring owner.

Register candidates inactive; activate only after Gate 7. Verify bundle hashes at service startup using the mechanisms in [`retraining/version_file.py`](retraining/version_file.py) and [`retraining/registry.py`](retraining/registry.py). A missing or mismatched artifact is a fail-closed model-unavailable state.

### Architecture decision

- **Remote inference (matches current code):** update the manuscript; prove TLS/authentication, masked-only payloads, minimization, retention/access controls, service latency/availability, and a caution-only offline fallback.
- **On-device inference (matches current manuscript wording):** first supply and version a converted model and tokenizer, integrate an Android runtime, and measure parity against the source checkpoint plus supported-device latency, memory, storage, battery, offline behavior, and update/rollback. Until all exist, do not claim on-device XLM-RoBERTa, SHAP, or HDBSCAN.

**Gate 8 passes when:** a hash-verified bundle is deployed to the approved architecture and rollback is demonstrated.  
**Stop immediately if:** deployment uses an unregistered directory, a missing `version.json`, or an architecture different from the approved manuscript method.

## 10. Retraining parity gaps to resolve

| Manuscript (pp. 233–236) | Current implementation | Required resolution before retraining claims |
|---|---|---|
| 3,000-row class-balanced replay; roughly 70% replay/30% new | `max_history` defaults to uncapped history; reports are added separately. | Approve and implement one versioned sampling policy; justify it from retention, class balance, and drift goals. |
| Start from deployed weights; 3 epochs | Default base is `xlm-roberta-base`; four epochs. | Adopt the approved method lock in Section 2 and update both code and manuscript. |
| Permanent held-out test drives promotion | Candidate and incumbent are compared on the candidate's fresh snapshot validation split; baseline exposure is acknowledged in [`retraining/pipeline.py`](retraining/pipeline.py#L28). | Separate development selection from a controlled release-test gate and log every access. |
| F1 cannot decrease; conditional McNemar method | Code permits a 0.01 drop and uses the exact binomial form for all discordant counts, plus a useful Scam-recall guard. | Predeclare justified safety margins/test form; preserve the Scam guard and add harmful-false-positive/slice gates. |
| Validated reports append automatically; automatic workflow | Live database ingestion is disabled in privacy-first mode; activation is deliberately manual. | Prefer consented offline export and human release approval, then amend the manuscript. |
| Weights pushed to mobile clients | No Android-compatible model artifact/runtime exists. | Either complete and validate on-device delivery or describe remote inference accurately. |

Retraining cannot begin until a valid v1 bundle exists. Repeated reuse of one permanent test set can itself overfit release decisions; establish a controlled-access policy and add prospective time-sliced evaluation data for later versions.

## 11. Defense evidence packet

The thesis defense packet must contain, with hashes and dates:

1. approved protocol amendment and architecture decision;
2. source/license/consent register and data card;
3. annotation manual, annotator training, agreement, adjudication, and label audit;
4. preprocessing version and privacy review;
5. split/group manifests and zero-overlap report;
6. reproducible run specification, environment, logs, seeds, and learning curves;
7. calibration/threshold report;
8. locked-test metrics, confusion matrix, uncertainty, slices, and error analysis;
9. candidate-versus-incumbent gate decision and sign-offs;
10. immutable model bundle/model card, registry record, deployment/rollback proof, and—only if selected—real-device evidence.

Existing files under [`evaluation/`](evaluation/) may be retained as historical records, but they must be labeled **unreproduced in this checkout** until their exact checkpoint, data snapshot, predictions, and hashes are restored.

## 12. RACI

| Deliverable | Track B — AI/ML (Maxene) | Track A — Backend (Reymark) | Team | Adviser / ethics authority |
|---|---|---|---|---|
| Data provenance, labels, splits, training, calibration, evaluation, model card | **R** | C | C | **A** for research method/ethics |
| Consent/export contract, service auth, registry, remote deployment, rollback | C | **R** | C | A/C for privacy-method changes |
| Participant-facing label mapping, mobile behavior, on-device feasibility and QA | C | C | **R** | **A** for claimed architecture |
| Manuscript amendment and defense packet | **R** for ML sections | R for backend facts | **R** for owned sections | **A** |
| Release decision | R | R | C | **A** |

`R` = performs the work; `A` = accepts the thesis/research decision; `C` = consulted. This plan does not alter repository ownership: Track B owns AI/ML implementation, Track A owns backend integration, and manuscript/WBS changes follow the team's existing ownership rules.

## 13. Ordered acceptance checklist

- [ ] 1. Adviser/ethics approval records the labels, inference location, training/retraining method, promotion rule, and feedback-consent flow.
- [ ] 2. Every corpus source passes provenance, license/permission, privacy, retention, and hash checks.
- [ ] 3. The annotation protocol, agreement/adjudication evidence, and conflict-failing loader are complete.
- [ ] 4. Leakage-safe train/development/release-test splits and manifests are frozen; test overlap is zero.
- [ ] 5. A predeclared, reproducible fine-tuning specification and evaluation targets are locked.
- [ ] 6. Training is reproduced from a clean environment; no test data informed model selection.
- [ ] 7. Calibration and routing thresholds are frozen from development data; auto-block remains off unless separately approved and proven safe.
- [ ] 8. Locked-test reporting and every aggregate/class/slice safety gate pass.
- [ ] 9. The immutable model bundle and `version.json` verify; registry, deployment, health check, and rollback succeed.
- [ ] 10. Code, manuscript, model card, and defense packet describe the same implemented process with no unsupported performance or on-device claim.

Completion means all boxes are checked with linked evidence—not merely that pipeline code exists. Until then, the defense-safe statement is: **“The training, evaluation, and deployment pipeline is implemented, but the approved corpus, reproducible checkpoint, calibrated operating point, and deployment evidence are not yet present in this checkout.”**
