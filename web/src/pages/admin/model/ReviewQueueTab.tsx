/*
 * Detection review queue.
 *
 * Training only ever learned from user reports, so scams the model caught on
 * its own -- and the confident mistakes nobody reports -- never reached a
 * person. Adding detections automatically would train the model on its own
 * errors, so instead the system suggests and an admin decides: each label
 * chosen here becomes one reviewed training sample, and Skip drops a message
 * for good. Only messages from users who opted in (Privacy & data on the
 * phone), received after they opted in, are offered -- masked text only.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  StatusBadge,
  type StatusKind,
} from '../../../components/primitives';
import { MaskedMessage } from '../../../components/masked/MaskedMessage';
import {
  confirmReviewCandidate,
  getReviewQueue,
  skipReviewCandidate,
  type ReviewCandidate,
  type ReviewKind,
  type TrainingLabel,
} from '../../../services/datasetsService';
import {
  MUTED,
  Notice,
  SectionHeader,
  errorText,
  formatDateTime,
} from './shared';

const KINDS: Array<{ value: ReviewKind; label: string; hint: string }> = [
  {
    value: 'detected',
    label: 'Detected scams',
    hint: 'The model called these Scam on its own. One per campaign.',
  },
  {
    value: 'uncertain',
    label: 'Uncertain',
    hint: 'The model was not confident either way.',
  },
  {
    value: 'spot_check',
    label: 'Spot-check (called safe)',
    hint: 'A random sample the model called safe, where missed scams hide.',
  },
];

const ACTIONS: Array<{ label: TrainingLabel; text: string }> = [
  { label: 'Scam', text: 'Scam' },
  { label: 'Spam', text: 'Spam' },
  { label: 'Ham', text: 'Real message' },
];

function kindFor(label: string | null): StatusKind {
  if (label === 'Scam') return 'threat';
  if (label === 'Spam') return 'suspicious';
  if (label === 'Ham') return 'verified';
  return 'unknown';
}

export function ReviewQueueTab() {
  const [kind, setKind] = useState<ReviewKind>('detected');
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'status' | 'alert';
    text: string;
  } | null>(null);

  const load = useCallback(async (which: ReviewKind) => {
    setLoading(true);
    setError(null);
    try {
      setCandidates(await getReviewQueue(which));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(kind);
  }, [kind, load]);

  async function decide(
    candidate: ReviewCandidate,
    label: TrainingLabel | null,
  ) {
    setBusyId(candidate.messageId);
    setNotice(null);
    try {
      if (label) await confirmReviewCandidate(candidate.messageId, label);
      else await skipReviewCandidate(candidate.messageId);
      setCandidates((rows) =>
        rows.filter((row) => row.messageId !== candidate.messageId),
      );
      setNotice({
        tone: 'status',
        text: label
          ? `Added to the training dataset as ${label === 'Ham' ? 'a real message' : label}.`
          : 'Skipped. It will not be offered again.',
      });
    } catch (e) {
      setNotice({ tone: 'alert', text: errorText(e) });
    } finally {
      setBusyId(null);
    }
  }

  const current = KINDS.find((k) => k.value === kind) ?? KINDS[0];

  return (
    <section aria-labelledby="review-queue-heading">
      <SectionHeader
        id="review-queue-heading"
        title="Messages to label"
        description={`${current.hint} Only your label is saved.`}
        actions={
          <>
            <div style={{ width: 220 }}>
              <Select
                label="Show"
                hideLabel
                value={kind}
                onChange={(e) => setKind(e.target.value as ReviewKind)}
                options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
              />
            </div>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void load(kind)}
            >
              Refresh
            </Button>
          </>
        }
      />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {loading ? (
        <LoadingState label="Loading review queue" />
      ) : error ? (
        <ErrorState
          title="Review queue unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load(kind)}>
              Retry
            </Button>
          }
        />
      ) : candidates.length === 0 ? (
        <div className="bantai-p-table-wrap">
          <div className="bantai-p-table__state">
            <EmptyState
              title="Nothing to review"
              description="No opted-in messages are waiting here."
            />
          </div>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {candidates.map((c) => (
            <li
              key={c.messageId}
              aria-label={`Candidate received ${formatDateTime(c.receivedAt)}`}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 10,
                background: 'var(--surface-raised)',
              }}
            >
              <MaskedMessage text={c.maskedText} />
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  margin: '10px 0',
                  fontSize: '0.85rem',
                }}
              >
                <span style={MUTED}>Model said</span>
                <StatusBadge
                  kind={kindFor(c.label)}
                  label={c.label ?? 'Unknown'}
                />
                {c.score !== null && (
                  <span style={MUTED}>
                    {Math.round(c.score * 100)}% confidence
                  </span>
                )}
                <span style={MUTED}>· {formatDateTime(c.receivedAt)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{ ...MUTED, fontSize: '0.85rem', alignSelf: 'center' }}
                >
                  {"It's really:"}
                </span>
                {ACTIONS.map((a) => (
                  <Button
                    key={a.label}
                    size="sm"
                    variant="secondary"
                    disabled={busyId !== null}
                    onClick={() => void decide(c, a.label)}
                  >
                    {a.text}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId !== null}
                  onClick={() => void decide(c, null)}
                >
                  Skip
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ReviewQueueTab;
