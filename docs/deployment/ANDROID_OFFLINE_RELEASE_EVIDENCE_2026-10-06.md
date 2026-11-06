# Android offline Model C student-release evidence — completed 2026-10-07

## Release decision

The signed **1.1 / version-code 2 student release is complete**. The APK and AAB contain the hash-bound portable Model C model and tokenizer. The non-debuggable APK upgraded the retained signed 1.0 installation on the owned API 34 x86_64 emulator, retained the default SMS role, and saved an incoming synthetic SMS verdict from the native model with no active network and no application crash. The same certificate signs both versions.

Distribution: `C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-07`. This is student-test approval; production approval and physical-phone acceptance remain separate. The older 1.0 files are retained as historical artifacts.

## Immutable model evidence

| Item | Recorded value |
| --- | --- |
| Source signed INT8 model | `2478923ccdb9fc9db9de0644f3eb3eb8cc7e4f6421a1b222dbae84b3b5feb57e` |
| Portable U8U8 model | `61b0d35542e198b98019952e69ff5b1194da50dcbfabf922d5e5b092fda67b3d` |
| FP32 reference | `b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253` |
| Frozen holdout | `31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755`, 3,236 rows |
| Candidate version | `candidate-2026-09-21-colab-C-local-u8u8` |
| Conversion | Exact +128 offset of 148 signed weight/zero-point initializers; unchanged scales |
| Approval boundary | Student test approved; production release false; physical-device validated false |

The original signed model and its original parity fixtures were not overwritten. The portable model is a new candidate, and its portable fixtures were generated only after the regression gate passed.

## Quality result

Evaluation used batch size one, an unpadded sequence, INT64 IDs, an all-ones INT64 attention mask, maximum length 128 and the production preprocessing/tokenizer contract.

| Metric | FP32 | Portable U8U8 | Observed drop | Gate |
| --- | ---: | ---: | ---: | ---: |
| Macro-F1 | 0.9635 | 0.9609 | 0.0026 | <= 0.01 |
| Scam recall | 0.9572 | 0.9511 (467 / 491) | 0.0061 | <= 0.01 |

The actual Android API 34 x86_64 runtime also evaluated all 3,236 pretokenized
holdout rows with networking disabled. Its macro-F1 was **0.9601255575** and Scam
recall **0.9490835031 (466 / 491)**. Drops of 0.00337444 and 0.00811650 passed the
same 0.01 gate. The native confusion matrix (rows/columns Ham, Spam, Scam) was
`[[1751,26,10],[37,908,13],[11,14,466]]`.

Native report SHA-256:
`21b7bc2f9e7392268c015d5c621e3779406ff589cc9406a096a6d7ab2c16b0c0`.
Its private input SHA-256 was
`bf7886d4911a0b70dc53e27a919de526520cd290b8d7249332a49c98bc32fc7d`;
the copied device file matched before evaluation. Inputs contained only integer
token IDs and truth labels, remained outside the APK/AAB, and were not uploaded.
This run establishes emulator regression quality; the holdout remains reused and
physical ARM/device behavior remains unverified.

There were 33 label disagreements. Portable threshold routing for true Scam rows was 11 Safe, 13 Spam, 463 high-risk review and 4 review; FP32 routed 10, 11, 468 and 2 respectively. The gate passed. Because this frozen holdout was reused for earlier evaluations, this is not an independent final evaluation.

## Runtime and integration evidence

- ONNX Runtime was upgraded from 1.22 to 1.30. The upgrade alone did not fix the old signed-model parity mismatch.
- The portable host output for the problematic first fixture matched the Android signed-kernel output, while the preserved original host fixture had reported Ham 0.99897 instead of Android's Scam 0.5907. This supports the U8S8 CPU-kernel diagnosis; it does not retroactively validate the old fixture.
- Hugging Face versus ONNX tokenizer parity passed all 16 fixtures.
- ONNX Runtime telemetry initialization is removed from the merged Android manifest, and runtime telemetry is disabled explicitly.
- Offline completed classifications retain model version, model hash and score. History scans do not notify for old messages, and cloud/user decisions retain precedence.
- The latest completed JVM evidence is 187 passing tests in 33 suites.
- Backend readiness returned HTTP 200 on 2026-10-06 at 15:55 UTC (2026-10-06 23:55 Asia/Manila). This verifies the cloud endpoint separately from Android packaging or native inference.

## Verification ledger

The first signed 1.1 build was withheld after the incoming-SMS smoke test found
an R8/JNI abort: `ai.onnxruntime.TensorInfo` had been removed. The release rules
now preserve `ai.onnxruntime.**` classes and members, as required by the
[official ONNX Runtime Android instructions](https://onnxruntime.ai/docs/build/android.html#note-proguard-rules-for-r8-minimization-android-app-builds-to-work).
The failed package receipt and native crash log remain private QA evidence;
The rebuilt signed APK subsequently passed the offline incoming-SMS and 1.0-to-1.1 upgrade check; only those rebuilt artifacts are distributed.

The first portable native runs retained a numerical failure: raw-logit differences
reached 0.26757 and probability differences reached 0.00966015 across all 16 synthetic
fixtures. All token IDs, winning labels and threshold routing decisions matched.
These dynamic-activation quantization differences are reproducible across CPU builds;
the host's graph optimization and thread changes did not remove them. Exact numerical
host/Android parity is not established. Synthetic token/decision checks and the full
Android holdout regression are separate gates. Failed runs 4, 5 and 6 are preserved.

| Gate | Status | Evidence / boundary |
| --- | --- | --- |
| Exact offset conversion | Passed | 148 expected initializers; portable SHA recorded above |
| Frozen-holdout regression | Passed | Both drops within 0.01 under exact Android contract |
| Actual Android holdout regression | Passed | All 3,236 rows; native macro-F1 0.9601, Scam recall 0.9491; hash-bound report |
| Tokenizer parity | Passed | 16 / 16 fixtures |
| JVM tests | Passed | 187 tests, 33 suites |
| Earlier native run | Retained failure | 4 tests: Unicode, Room and WorkManager passed; old numeric fixture failed |
| Final native portable run | Passed | Six tests; exact tokens/labels/routes, Room, WorkManager and silent signed-out history; numerical differences disclosed above |
| Release lint/static analysis | Passed | Full ktlint, detekt and native/model release gates; final debug build successful |
| Signed 1.1 APK/AAB | Passed | Version 1.1 / code 2; exact model/tokenizer assets, HTTPS URL, signatures and ZIP alignment verified |
| Signed APK offline upgrade / incoming SMS | Passed on emulator | Same-signer 1.0 upgrade, retained SMS role, non-debuggable, native verdict persisted, no active default network or application crash |
| Physical Android phone | **Pending / unavailable** | No phone available; install, permissions, SMS and device performance unobserved |
| Production release | **Not approved** | Candidate is limited to authorized student testing |

## Final artifact receipt

| Artifact | Bytes | SHA-256 | Verification |
| --- | ---: | --- | --- |
| 1.1 APK | 445,215,047 | `da65ccf3d3e3f2637d901cb31356fc4c33bf92948da7bf738e6d626180555751` | apksigner v2, 16 KB ZIP alignment; signed offline SMS smoke |
| 1.1 AAB | 282,492,256 | `81958256b3109a045316752e33a4b415a0575b962b033e1ce62cc459d5342ceb` | jarsigner verified; embedded assets verified |
| 1.1 R8 mapping archive | 4,185,219 | `258cb747390ffa0b23c8c39cbe9fd7a00a722c15e602da9e9e1ecf665c71b69f` | Final rebuild mapping archived |

Signer SHA-256: `0e8e81ee2e4806328909a98e4ff6a96919f739a18750f3add339ff1cf05ff436`. Android minimum API 26, target 35. ONNX Runtime JNI classes are retained by the final R8 configuration. APK manifest inspection found no ONNX telemetry initializer; the signed release is not debuggable.

The AAB verification reports the expected self-signed student certificate, no timestamp, and JarInputStream ordering warnings; JarFile signature verification succeeds. The AAB is retained for bundle tooling, and has not been uploaded to Google Play. The APK is the direct-install artifact. ZIP alignment is not a claim of physical ARM or Play compatibility.

The distributed evidence includes aggregate host/native reports and synthetic test logs, without frozen SMS data, private holdout inputs or signing secrets. At build time the release patches were uncommitted; the distributed `source-manifest.json` preserves those exact build-time bytes and the PR112 base commit. Subsequent source commits and review fixes do not replace that signed-artifact provenance. The protected original checkout and Gio-owned trackers remain untouched.
