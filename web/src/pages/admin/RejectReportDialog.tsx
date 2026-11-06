/*
 * Reject a user report, saying what the text really is.
 *
 * Mobile 1.7 auto-blocks the sender when a user reports a text as Scam. When
 * the team rejects that report the phone lifts the block, and with this answer
 * it also moves the text to Messages (Ham) or Spam. The choice is required so
 * a rejection can't leave the phone guessing.
 */

import React, { useEffect, useId, useState } from 'react';
import { Button, Dialog } from '../../components/primitives';
import type { ReviewedLabel } from '../../services/reportsService';

interface RejectReportDialogProps {
  open: boolean;
  /** How many reports this rejects (a group "Reject all" can be several). */
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reviewedLabel: ReviewedLabel) => void;
}

const OPTIONS: Array<{ value: ReviewedLabel; label: string; hint: string }> = [
  {
    value: 'Ham',
    label: 'Real message',
    hint: 'Legitimate text. It moves back to Messages on the phone.',
  },
  {
    value: 'Spam',
    label: 'Spam',
    hint: 'An honest promotion, not a scam. It moves to Spam on the phone.',
  },
];

export function RejectReportDialog({
  open,
  count,
  busy,
  onCancel,
  onConfirm,
}: RejectReportDialogProps) {
  const [choice, setChoice] = useState<ReviewedLabel | null>(null);
  const name = useId();

  // Every rejection starts unanswered: never carry the last choice over.
  useEffect(() => {
    if (open) setChoice(null);
  }, [open]);

  return (
    <Dialog
      open={open}
      title={count > 1 ? `Reject ${count} reports` : 'Reject report'}
      description="The reporter's block on this sender is lifted. Say what the text really is so their phone files it correctly."
      // Escape/backdrop can't abandon a rejection that's already being sent.
      onClose={busy ? () => undefined : onCancel}
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={busy || choice === null}
            onClick={() => choice && onConfirm(choice)}
          >
            {count > 1 ? `Reject ${count}` : 'Reject'}
          </Button>
        </>
      }
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>
          What is this message really?
        </legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ display: 'block', fontWeight: 500 }}>
                {option.label}
              </span>
              <span
                style={{
                  display: 'block',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                }}
              >
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}

export default RejectReportDialog;
