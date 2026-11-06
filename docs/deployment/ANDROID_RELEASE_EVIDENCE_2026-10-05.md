# Android student-test release evidence — 2026-10-05

## Outcome

A signed, minified Android APK and signed Android App Bundle were built from the
PR #112 release worktree against the deployed student Azure backend. This is the
first observed student-test signing lineage for `com.bantai`; repository and
filesystem searches found no prior team release keystore, signed APK, or signed
AAB to preserve.

The build completed with `BUILD SUCCESSFUL in 7m 49s` and 64 executed tasks:

```powershell
.\gradlew.bat :app:assembleRelease :app:bundleRelease `
  -PbantaiReleaseBackendUrl=https://bantai-student-backend.calmsand-1a6d5c6b.eastasia.azurecontainerapps.io/api
```

The four `BANTAI_RELEASE_*` variables were supplied from the protected signing
handoff described below. `preReleaseBuild` rejects missing signing values,
placeholder hosts, and non-HTTPS release URLs.

## Distribution artifacts

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-05\bantAI-student-test-1.0.apk` | 77,978,909 | `f9719a01ab47e5972fd4744ff196885fac08b92deca922aec638385f49577d8d` |
| `C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-05\bantAI-student-test-1.0.aab` | 33,951,930 | `301210c52c912a855c1089b37c0e40447fac646ca7b679a64920e761af1fa10e` |
| `C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-05\bantAI-student-test-1.0-r8-mapping.zip` | 4,030,888 | `d0f909f0b9f6395f3f067820b48b6e8e181c5f38b5bf93d4560fff08452ec8b3` |

The APK is the directly installable tester artifact. The AAB is an upload
artifact and cannot be installed directly. Preserve the R8 mapping archive for
deobfuscating crashes from this exact build.

## Package and signer verification

- `apksigner verify --verbose --print-certs` passed with one APK signer using
  APK Signature Scheme v2.
- `zipalign -c -v 4` passed.
- `jarsigner -verify` returned exit code 0 for the AAB. It reports the expected
  self-signed certificate and missing-timestamp warnings for this local
  student-test/upload identity.
- Signer: `CN=bantAI Student Test Distribution, OU=THESONE Group 7,
  O=De La Salle Lipa, L=Lipa, ST=Batangas, C=PH`.
- Certificate SHA-256:
  `0e8e81ee2e4806328909a98e4ff6a96919f739a18750f3add339ff1cf05ff436`.
- Key: RSA 4096, SHA256withRSA; certificate validity ends 2046-10-05.
- Manifest: package `com.bantai`, version name `1.0`, version code `1`, min SDK
  26, target SDK 35. The release manifest has no `debuggable=true` attribute.
- The exact deployed HTTPS backend URL was found inside both packaged artifacts.
  Neither package contains `model_int8.onnx` or `tokenizer.onnx`.

## Signing handoff and recovery boundary

The new student-test identity is outside the repository and restricted by NTFS
ACL to the current Windows account:

```text
C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\android-student-test-signing\bantai-student-test-distribution.p12
C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\android-student-test-signing\bantai-student-test-signing.clixml
```

The CLIXML password is protected with Windows DPAPI for this user on this
machine. Copying the `.p12` and `.clixml` elsewhere does not make a recoverable
backup. `Copy-BantAISigningPassword.ps1` in the same directory copies the
password to the clipboard without printing it; use that helper to save the
password in the team's password manager, then clear the clipboard. Future
updates to an installed student-test APK must use this exact `.p12` key.

`Build-StudentRelease.ps1` in that directory provides the local rebuild command:
it imports the protected credential, supplies signing values and the SDK path,
uses the live HTTPS backend, then restores the previous environment. Its
PowerShell syntax was checked; the observed successful build above supplied the
same values directly before this helper was created.

An existing debug-signed installation cannot be upgraded in place to this new
lineage. Uninstall it before installing the release APK; uninstalling clears the
app's local data.

## Model and runtime boundary

The Android production path sends locally masked text to the deployed private
Model C service through the backend. Its offline path is a keyword-based caution
and never claims a Model C verdict. The release deliberately does not package
the existing ONNX feasibility artifacts because the app has no production
on-device tokenizer/classifier path.

The separately preserved Colab-C INT8 export is tied to checkpoint SHA-256
`85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b`.
Its 3,236-row ONNX holdout report records macro-F1 0.9630, Scam recall 0.9491,
37 label disagreements versus PyTorch, and a Scam recall drop of 0.0081, within
the recorded 0.01 tolerance. That report reused a holdout previously compared
across several candidates, so it is evidence of export parity and observed
quality, not an untouched final evaluation. The mobile-bundle manifest remains
`release_approved: false`; the operator's deployment approval is recorded
separately and does not fabricate an on-device approval.

## Unobserved checks

`adb devices -l` returned no devices, and the user confirmed no Android phone is
available. Therefore installation, launch, default-SMS-role acquisition,
permission prompts, OTP on Android, incoming SMS/MMS interception, and real
device latency were not observed. These packages are ready for a later physical
device test; this document does not claim those checks passed.

Current mobile onboarding uses backend email OTP, independently of the web
administrator's portal session. Email inbox delivery and portal authentication
passed, but the Android onboarding screens remain unobserved. Semaphore's
account is Active with 1,010 credits; sender BANTAIPH is Pending, so SMS-provider
delivery is not a completed gate.

The source/configuration changes and this evidence remain uncommitted under the
repository rule that Codex must not create commits.
