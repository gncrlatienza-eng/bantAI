# Model folders — which version is which

Everything in `ai/models/` except this file is git-ignored (model weights are
too large for git and are backed up on Google Drive instead, under
`bantai/models/`, one folder per version).

**Do not rename these folders.** The service and scripts read them by path.

| Folder | Version | What it is |
|---|---|---|
| `xlm-roberta-smishing/` | `v2026-08-27T09-46-20Z` | **LIVE** — the model the AI service serves. Promoted 2026-08-30. |
| `xlm-roberta-smishing.pre-2026-08-27-promotion-backup/` | `v2026-07-29-run3` | The original model. Rollback copy. |
| `retraining_runs/2026-08-27T09-46-20Z/` | `v2026-08-27T09-46-20Z` | The run that produced the LIVE model. `candidate/` is an identical copy of it (same `model.safetensors` sha256, `6509d362ca92dfc9…`); `decision.json` / `manifest.json` record the gate verdict. |
| `retraining_runs/2026-08-26T*/`, `2026-08-27T09-28-21Z/` | — | Records only (gate decisions, manifests). The weights were never kept. |
| `retraining_runs/round-trip-scratch/` | — | Scratch space for `scripts/round_trip.py`. |
| `onnx_export/` | `v2026-08-27T09-46-20Z` | On-device feasibility spike (2026-09-16/21). `model_int8.onnx` is what a phone would run; `model_fp32.onnx` is regenerable with `scripts/export_onnx_poc.py`. |
| `retrain_queue/` | — | Used by the AI service's `POST /retrain`. |

Each version folder has a `version.json` with its version tag and the sha256 of
its `model.safetensors` — that file, not the folder name, is the source of truth.

## Adding a new model (e.g. a Colab retrain)

Put it in a **new** folder, never over `xlm-roberta-smishing/`:

```
retraining_runs/<YYYY-MM-DD>-colab/candidate/
```

It only replaces the LIVE model after the holdout test and the promotion gate
(Scam-recall floor included). When it does, keep the outgoing LIVE model as a
rollback copy and add a row to the table above.

## Disk space

The `checkpoint-*` subfolders inside each model folder (~3 GB each) are only
needed to *resume* an interrupted training run. The service never reads them.
