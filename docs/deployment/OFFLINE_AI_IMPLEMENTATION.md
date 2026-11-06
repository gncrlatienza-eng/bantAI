# BantAI offline AI implementation status (2026-09-28)

## Implemented in this working tree

- `ai/scripts/build_mobile_bundle.py` now builds the selected 2026-09-21-colab-C checkpoint's INT8 bundle in gitignored `ai/models/mobile_bundle_colab_C/`. Model-C shipped without a SentencePiece binary, so the builder verifies every base-vocabulary piece and score against a separately supplied binary, then checks Model-C added-token behavior and tokenizer parity on 16 synthetic fixtures. The Android adapter applies the same split/stitch rule for the five reserved tokens. The bundle records hashes and `release_approved: false`.
- Android bundles that private model directory when it exists, verifies hashes on first use, performs text preprocessing/tokenization and CPU inference locally, and records `ON_DEVICE` / `CLOUD_VERIFIED` / `CLOUD_DISAGREEMENT` / `UNAVAILABLE` provenance with score and model hash. The SMS broadcast only persists and schedules durable background work. A pending notification is replaced by the eventual result. No raw SMS is placed in WorkManager input.
- A first-time user can complete local onboarding and reach Messages and on-device Alerts without an email OTP. Expired cloud credentials or signing out do not stop local protection. Connecting an account later queues previously analyzed, unsynced messages for network-constrained synchronization; the account screen discloses that behavior.
- Network-constrained sync goes through NestJS, not directly to the Python service. A backend `device_fallback` or duplicate response is not treated as independent verification. When real cloud AI disagrees, the app retains the higher-risk local/cloud classification for safety and displays `CLOUD_DISAGREEMENT`; local label and score remain recorded. The app's existing remote privacy masker is retained for network transmission; it is intentionally not the local model preprocessing.
- Reymark reports that the advisor selected **2026-09-21-colab-C (Model-C)**. Android debug builds now use that checkpoint's bundle; the APK's embedded manifest identifies its checkpoint SHA-256 as `85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b`. Gradle blocks release builds without an independently approved manifest, evaluation reference, matching artifact hashes, a signing keystore, and a configured HTTPS backend URL. Approval metadata is a team process gate, not proof of model quality by itself.

## Evidence and limits

- Model-C FP32 ONNX: 1,060.9 MiB. INT8 ONNX: 265.9 MiB. Latest built debug APK: 401,414,138 bytes (about 383 MiB); tokenizer graph 5,069,578 bytes. The APK contains `model_int8.onnx`, `tokenizer.onnx`, and the Model-C manifest. The app additionally copies the model into private storage for file-backed ONNX loading.
- A 3,236-row **reused historical** holdout comparison of this exact Model-C export yielded PyTorch/FP32 macro-F1 0.9635 and Scam recall 0.9572 versus INT8 macro-F1 0.9630 and Scam recall 0.9491 (37 label disagreements; four additional missed scams). This is a conversion check, **not an independent generalization estimate**; data leakage cannot be ruled out. The restricted CSV remains gitignored.
- Model-C debug compilation, Android JVM unit tests and Android lint passed after small Compose fixes in `SenderAvatar.kt` and `MessagesScreen.kt`; the APK was inspected to confirm that it contains Model-C's checkpoint hash. Python AI tests: **568 passed, one skipped**, including packaged tokenizer-plus-INT8 model inference; Ruff passed. The available `BantAI_Test` emulator appeared to adb as **unauthorized**, so there is still **no Android runtime inference, cold-start, memory, battery or airplane-mode SMS test**. The present 383 MiB APK is too large to assume it meets the desired lightweight release; no acceptable install-size or low-end-device threshold has been demonstrated.
- A local result can be displayed and notified without auth or internet once the debug package containing the model is installed. This is an implemented path, **not yet a device-validated release guarantee**. The generic pending notification is not itself an AI verdict.

## Release gates still required

1. Bind the reported advisor selection of Model-C to a written approval reference and artifact hash; obtain Maxene/Gio release sign-off on the checkpoint and threshold policy. Freeze a genuinely independent holdout that the selected teacher has never seen. The present historical holdout alone cannot establish that.
2. On representative low-end Android phones, install the signed release candidate, turn on airplane mode before first launch, receive a real SMS, and measure end-to-end p50/p95 time, model initialization, tokenization, peak RAM, disk, and battery. Confirm actual local score/label/provenance and notification while signed out.
3. Extend the Model-C split/stitch tokenizer parity corpus beyond the 16 builder fixtures and verify preprocessing/ONNX output on multilingual/Taglish, Unicode-obfuscated, URL, phone, special-token and long-SMS inputs. Check ONNX Runtime Extensions Android 0.13 native tokenizer and INT8 operator compatibility on those devices.
4. Set an explicit APK/download, storage, latency, memory, battery, Scam-recall, and Ham-false-positive budget. If 265.9 MiB INT8 XLM-R misses device or size budgets, distill a multilingual student from an approved teacher and rerun the same independent gates. A student is still real AI, but its quality must be measured rather than assumed.
5. Verify retry/idempotency, post-sign-in backfill, cloud correction, and account-switch isolation against an actual deployed NestJS/FastAPI stack; exercise airplane mode, reconnect, backend outage, account sign-in later, sign-out while sync is in flight, and server model outage. No live end-to-end cloud test was run here. A previously cloud-enriched local verdict can remain visible after sign-out; decide and test the account-switch provenance policy before release.
6. Keep `release_approved: false` until independent model and physical-device evidence is recorded. Do not present this debug feasibility build as released offline AI in the thesis or user-facing claims.

## Reproduce the local debug bundle

From the repository root, after preparing the private checkpoint and Python dependencies:

```powershell
ai/.venv/Scripts/python.exe ai/scripts/export_onnx_poc.py --model-dir ai/models/candidates/2026-09-21-colab-C --output-dir ai/models/onnx_export_colab_C
ai/.venv/Scripts/python.exe ai/scripts/build_mobile_bundle.py --model-dir ai/models/candidates/2026-09-21-colab-C --onnx-dir ai/models/onnx_export_colab_C --output-dir ai/models/mobile_bundle_colab_C --sentencepiece-model ai/models/retraining_runs/2026-08-27T09-46-20Z/candidate/sentencepiece.bpe.model
cd mobile
./gradlew.bat :app:assembleDebug :app:testDebugUnitTest
```

The separate SentencePiece binary is accepted only after all base pieces and scores match Model-C's tokenizer JSON. A future release must use the independently reviewed Model-C artifact and bundle, not assume that `models/xlm-roberta-smishing` points to it. Model binaries and private SMS data must never be committed.
