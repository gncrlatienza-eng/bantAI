# Android offline Model C integration evidence

Date: 2026-10-05, updated 2026-10-07 (Asia/Manila). Scope: operator-authorized student testing.

## Current status

The on-device Model C implementation and signed **1.1 / version-code 2 student APK/AAB are complete**. Host and actual Android regression quality gates passed, along with six Android integration tests, 187 JVM tests, ktlint, detekt and release lint. The signed release upgraded 1.0 and saved a native incoming-SMS result without an active network on the owned emulator. See [final package and evidence receipts](ANDROID_OFFLINE_RELEASE_EVIDENCE_2026-10-06.md). Production and physical-phone acceptance remain unverified.

The retained signed 1.0 artifacts are historical; they used cloud Model C and a heuristic offline fallback. The 1.1 package embeds the model and tokenizer and preserves the same signing identity.

## Artifact identity and exact portable conversion

The source checkpoint, signed INT8 export and SentencePiece tokenizer remain preserved. The Android candidate was produced by an exact representation change for the 148 signed `MatMulInteger` weight and zero-point initializers:

`q_unsigned = q_signed + 128`, `zero_unsigned = zero_signed + 128`

Scales are unchanged, so `(q_unsigned - zero_unsigned) * scale` equals the original dequantized value exactly. This is not retraining, recalibration or a new model-quality fit. It avoids the CPU-specific U8S8 saturation behavior observed during Android parity work.

| Artifact | SHA-256 |
| --- | --- |
| Source checkpoint | `85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b` |
| Preserved source INT8 ONNX | `2478923ccdb9fc9db9de0644f3eb3eb8cc7e4f6421a1b222dbae84b3b5feb57e` |
| Portable U8U8 Android candidate | `61b0d35542e198b98019952e69ff5b1194da50dcbfabf922d5e5b092fda67b3d` |
| FP32 reference | `b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253` |
| SentencePiece ONNX tokenizer | `3396f311d68a8ee4351c0949ab2626543334c5566d7f8ea17b026952ac14d0fe` |
| Frozen holdout CSV | `31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755` |

The new manifest version is `candidate-2026-09-21-colab-C-local-u8u8`. It records student-test approval only, with production release and physical-device validation both false. Conversion creates a new candidate directory and does not overwrite the source bundle. The original source artifacts and original CPU-specific parity fixtures remain preserved; portable fixtures are generated only after the quality gate passes.

## Exact Android inference contract

- NFKC normalization, Unicode whitespace collapse/trim, then ordered EMAIL / URL / PHONE / AMOUNT / OTP masking, matching `ai/preprocessing`.
- Model C special-token split/stitch contract with `<s>` 0, `<pad>` 1, `</s>` 2, `<unk>` 3 and `<mask>` 250001. Ordinary graph segments are unwrapped before one BOS/EOS pair is applied.
- Batch size one, unpadded sequence, maximum length 128, INT64 input IDs and an all-ones INT64 attention mask.
- Class order Ham, Spam, Scam and stable softmax over raw logits; no temperature calibration file is applied locally. Route thresholds remain Ham 0.50, Spam 0.60 and Scam 0.90, with a 0.15 winner/runner-up margin. Weak or ambiguous results remain review/unknown. A confident local Scam verdict raises high-risk review without claiming the sender was blocked.
- Exact token-ID parity passed for all 16 Hugging Face/tokenizer-graph fixtures.

Android uses ONNX Runtime 1.30 with ONNX Runtime Extensions 0.13.0. The manifest removes the ONNX Runtime telemetry initializer, and the runtime also calls `setTelemetry(false)`. This is a privacy control for the embedded runtime; it does not replace network or package inspection.

## Reused frozen-holdout regression gate

Both FP32 and portable models were evaluated using the exact batch-one, unpadded Android contract over all 3,236 rows. This frozen holdout has already been reused for earlier evaluations, so this is a conversion/regression gate rather than an untouched independent final evaluation.

| Model | Macro-F1 | Scam recall | Scam true positives |
| --- | ---: | ---: | ---: |
| FP32 reference | 0.9635 | 0.9572 | 470 / 491 |
| Portable U8U8 | 0.9609 | 0.9511 | 467 / 491 |

The portable candidate has 33 label disagreements against FP32. Its macro-F1 drop is 0.0026 and Scam-recall drop is 0.0061, both within the recorded maximum drop of 0.01.

For the 491 true Scam rows, threshold routing was:

| Route | FP32 | Portable U8U8 |
| --- | ---: | ---: |
| Safe | 10 | 11 |
| Spam | 11 | 13 |
| High-risk review | 468 | 463 |
| Review | 2 | 4 |

These are measured regression results, not a claim of independent generalization or production approval.

## Why the old host fixtures were replaced for the portable candidate

The preserved signed U8S8 fixture 0 produced Ham probability 0.99897 on the original host path, while Android produced Scam probability 0.5907. Upgrading Android ONNX Runtime from 1.22 to 1.30 did not resolve the numeric mismatch. The portable U8U8 host logits and probabilities matched the prior Android signed-kernel result for that fixture, showing that the old host fixture was affected by the CPU-specific signed-kernel behavior. The original fixture remains preserved as historical evidence; it was not relabeled as portable parity.

## Android behavior and verification boundary

When cloud classification is unavailable, the app can run the bundled model locally and persist the classification with the model version, model SHA-256 and score. Existing-message history scans run without old-message notifications. A later or concurrent cloud result retains precedence, and campaign matching remains clearly separate from offline classification.

The JVM run passed 187 tests across 33 suites and the final Android integration run passed all six tests. Tokens, winning labels and threshold routes matched all 16 synthetic fixtures; maximum probability/logit differences were 0.00966015 / 0.26757, so bit-exact host/Android numerical parity is not claimed. Full native evaluation of 3,236 reused holdout rows produced macro-F1 0.9601255575 and Scam recall 0.9490835031 (466/491); both drops versus FP32 were within 0.01. Release gates independently recompute metrics from the confusion matrix and bind its report hash to the package manifest. Earlier numeric failures and the first signed R8/JNI failure are retained, and the rebuilt signed APK passed the offline upgrade/SMS smoke.

No Android phone is available. Installation, launch, default-SMS-role acquisition, permission prompts, incoming SMS/MMS interception, offline behavior after unplugging, battery use, latency and memory remain unobserved on physical hardware. Emulator evidence will not be presented as physical-device evidence.
