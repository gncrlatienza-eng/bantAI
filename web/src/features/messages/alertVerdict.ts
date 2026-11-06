/*
 * What the Messages inbox shows as an alert's classification.
 *
 * When the AI model doesn't answer in time, the backend stores the phone's
 * offline heuristic instead and marks the message `trusted: false`. That
 * heuristic only knows "looked suspicious" and sends it as label "Spam" with
 * score 0, so showing it verbatim turned unverified scams into "Spam 0%".
 * Those rows read "Checking…" while the cloud re-check is queued, and
 * "Unverified" once it has given up -- never as a model verdict.
 */

import type { StatusKind } from '../../components/primitives';
import type { SmsAlertItem } from '../../services/smsService';

export interface AlertVerdict {
  label: string;
  kind: StatusKind;
  /** Model confidence, or null when there is no model verdict to show. */
  confidence: number | null;
}

export const CHECKING_LABEL = 'Checking…';
export const UNVERIFIED_LABEL = 'Unverified';

// Cloud re-check states that mean a model verdict is still on its way.
const STILL_CHECKING = new Set(['pending', 'processing', 'retryable_failure']);

function labelToStatusKind(label?: string | null): StatusKind {
  switch (label) {
    case 'Scam':
      return 'threat';
    case 'Spam':
      return 'suspicious';
    case 'Ham':
      return 'verified';
    default:
      return 'unknown';
  }
}

export function alertVerdict(message: SmsAlertItem['message']): AlertVerdict {
  const classification = message.classification;
  // `trusted` is absent from older backends; treat that as "verified" so the
  // inbox behaves exactly as before against them.
  if (message.trusted === false) {
    const status = message.cloudVerifications?.[0]?.status;
    return {
      label:
        status && STILL_CHECKING.has(status)
          ? CHECKING_LABEL
          : UNVERIFIED_LABEL,
      // The phone flagged it as suspicious (that's why it alerted), so keep
      // it visibly cautionary -- just not a claimed model verdict.
      kind: 'suspicious',
      confidence: null,
    };
  }
  return {
    label: classification?.label ?? 'Unknown',
    kind: labelToStatusKind(classification?.label),
    confidence:
      typeof classification?.score === 'number' ? classification.score : null,
  };
}
