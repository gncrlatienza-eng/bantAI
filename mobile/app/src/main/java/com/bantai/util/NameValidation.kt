package com.bantai.util

const val NAME_MAX_LENGTH = 30

/**
 * Letters and whitespace only. Shared by onboarding (OnboardingViewModel) and
 * profile editing (SettingsViewModel) so the two paths can't silently diverge
 * on what counts as an acceptable name — they previously did: Settings only
 * validated first name, and re-implemented the check ad hoc instead of
 * sharing it, so last name could be saved with any characters at all there.
 */
fun isValidName(name: String): Boolean = name.trim().all { it.isLetter() || it.isWhitespace() }
