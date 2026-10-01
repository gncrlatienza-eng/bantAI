import type { AccessRequestTier } from '../../services/authService';

/*
 * The plan a visitor picked on the public page, carried through sign-up and
 * setup to preselect the application. A convenience only: the server never
 * reads it, and the applicant can change it before submitting.
 */

const KEY = 'bantai_intended_access';

export interface IntendedAccess {
  tier: AccessRequestTier;
  pilot: boolean;
}

export function rememberIntendedAccess(value: IntendedAccess) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the flow still works.
  }
}

export function readIntendedAccess(): IntendedAccess | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(KEY) ?? 'null',
    ) as Partial<IntendedAccess> | null;
    if (parsed?.tier === 'shield') {
      return { tier: 'shield', pilot: Boolean(parsed.pilot) };
    }
  } catch {
    // Ignore unreadable storage.
  }
  return null;
}

export function forgetIntendedAccess() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

export function tierFromQuery(search: string): AccessRequestTier | null {
  const tier = new URLSearchParams(search).get('tier');
  return tier === 'shield' ? tier : null;
}
