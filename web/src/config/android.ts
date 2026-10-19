/*
 * How the public site offers the Android app. One switch, so the landing
 * page never hard-codes a download it can't stand behind
 * (docs/redesign/landing-redesign-plan.md §2).
 *
 * - 'beta'   Play Protect's enhanced fraud protection (on by default in the
 *            Philippines since Feb 2025) blocks SMS apps installed from a
 *            browser, so the public button leads to the beta page.
 * - 'tester' Direct APK link for invited testers. Not for the public page.
 * - 'public' Only after the release checklist passes (store listing or a
 *            verified installer).
 */

export type AndroidDistribution = 'beta' | 'tester' | 'public';

export const ANDROID_DISTRIBUTION: AndroidDistribution = 'beta';

/** The build testers receive (GitHub release student-android-v1.7). */
export const ANDROID_RELEASE = {
  version: '1.7',
  tag: 'student-android-v1.7',
  published: '2026-10-16',
  fileName: 'bantAI-student-offline-1.7.apk',
  sizeLabel: '354 MB',
  url: 'https://github.com/gncrlatienza-eng/bantAI/releases/download/student-android-v1.7/bantAI-student-offline-1.7.apk',
  sha256: 'b840669d5973525d22602313eab71450baafdbc3cadf2e09c4d7f09167f9948d',
  requires: 'Android 8 or later on an ARM phone',
} as const;

export const ANDROID_BETA_PATH = '/android';

/** Label for the main Android button in the current mode. */
export function androidCtaLabel(
  mode: AndroidDistribution = ANDROID_DISTRIBUTION,
) {
  if (mode === 'public') return 'Get BantAI for Android';
  if (mode === 'tester') return 'Download tester build';
  return 'Join the Android beta';
}
