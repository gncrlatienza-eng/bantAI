import { describe, expect, it } from 'vitest';

import { CHECKING_LABEL, UNVERIFIED_LABEL, alertVerdict } from './alertVerdict';
import type { SmsAlertItem } from '../../services/smsService';

const base: SmsAlertItem['message'] = {
  id: 'm1',
  sourceId: 'k:1',
  receivedAt: '2026-10-14T00:00:00.000Z',
};

describe('alertVerdict', () => {
  it('shows a model verdict with its confidence', () => {
    expect(
      alertVerdict({
        ...base,
        trusted: true,
        classification: { label: 'Scam', score: 0.97, bucket: 'blocked' },
      }),
    ).toEqual({ label: 'Scam', kind: 'threat', confidence: 0.97 });
  });

  it('never shows the phone fallback "Spam 0%" as a verdict', () => {
    const verdict = alertVerdict({
      ...base,
      trusted: false,
      classification: { label: 'Spam', score: 0, bucket: 'unknown' },
      cloudVerifications: [{ status: 'failed' }],
    });
    expect(verdict.label).toBe(UNVERIFIED_LABEL);
    expect(verdict.confidence).toBeNull();
    expect(verdict.kind).toBe('suspicious');
  });

  it.each(['pending', 'processing', 'retryable_failure'])(
    'shows Checking… while the cloud re-check is %s',
    (status) => {
      expect(
        alertVerdict({
          ...base,
          trusted: false,
          classification: { label: 'Spam', score: 0, bucket: 'unknown' },
          cloudVerifications: [{ status }],
        }).label,
      ).toBe(CHECKING_LABEL);
    },
  );

  it('keeps the old behaviour when the backend does not send trusted', () => {
    expect(
      alertVerdict({
        ...base,
        classification: { label: 'Spam', score: 0.8, bucket: 'spam' },
      }),
    ).toEqual({ label: 'Spam', kind: 'suspicious', confidence: 0.8 });
  });
});
