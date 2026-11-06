# Vendored AOSP MMS PDU code

MMS encoder/decoder (WAP-209 / OMA MMS encapsulation) used to receive and,
later, send MMS. Android keeps these classes hidden from apps, so every
third-party SMS app ships its own copy.

- **Source:** https://android.googlesource.com/platform/frameworks/base
  `telephony/common/com/google/android/mms/` (+ `pdu/`)
- **Commit:** `1cdfff555f4a21f71ccc978290e2e212e2f8b168` (main, 2025-03-26)
- **License:** Apache License 2.0 — the original copyright/license header is
  kept at the top of every file.

## Changes from upstream (mechanical only)

1. Package `com.google.android.mms` and `com.google.android.mms.pdu` →
   `com.bantai.mms.pdu`, so they can't clash with the platform's hidden copy.
2. Removed `@UnsupportedAppUsage` annotations and their `android.compat.annotation`
   / `android.os.Build` imports (platform-internal, not in the public SDK).

Nothing else was edited. Not copied: `PduPersister` and `util/*` (hidden
APIs, DRM, caching) — `com.bantai.mms.MmsPersister` replaces the persister.

These files are Java, so ktlint/detekt (Kotlin-only) don't lint them; the
build also excludes this package explicitly. Don't reformat them — keeping
them byte-comparable with upstream makes future syncs a diff.
