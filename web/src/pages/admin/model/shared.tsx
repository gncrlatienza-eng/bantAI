import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button, Dialog } from '../../../components/primitives';

// Shared with every screen now; re-exported so the Model tabs keep importing
// them from here.
export { SectionHeader, StatPanel } from '../../../components/primitives';
import { formatCompactDateTime } from '../../../utils/dateFormat';

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatCompactDateTime(d);
}

export function humanize(value: string): string {
  const words = value.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const MUTED = { color: 'var(--text-secondary)' } as const;
export const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
} as const;

export function Notice({
  tone,
  children,
}: {
  tone: 'status' | 'alert';
  children: ReactNode;
}) {
  return (
    <p
      role={tone}
      style={{
        margin: '12px 0 0',
        fontSize: '0.9rem',
        ...(tone === 'alert' ? { fontWeight: 600 } : MUTED),
      }}
    >
      {children}
    </p>
  );
}

export interface NoteRequest {
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  destructive?: boolean;
  minLength?: number;
  /** Extra read-only context shown above the note field. */
  details?: ReactNode;
  onConfirm: (note: string) => Promise<void>;
}

/**
 * Asks for the reason behind a decision. Every lifecycle change in the model
 * and dataset workflow is recorded with one, so the dialog is shared.
 */
export function NoteDialog({
  request,
  onClose,
}: {
  request: NoteRequest | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const minLength = request?.minLength ?? 10;
  const fieldId = useId();

  useEffect(() => {
    setNote('');
    setError('');
  }, [request]);

  async function submit() {
    if (!request) return;
    setBusy(true);
    setError('');
    try {
      await request.onConfirm(note.trim());
      onClose();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={request !== null}
      title={request?.title ?? ''}
      description={request?.description}
      onClose={() => {
        if (!busy) onClose();
      }}
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={request?.destructive ? 'destructive-confirm' : 'primary'}
            disabled={busy || note.trim().length < minLength}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : request?.confirmLabel}
          </Button>
        </>
      }
    >
      {request?.details}
      <div className="bantai-p-field">
        <label htmlFor={fieldId} className="bantai-p-field__label">
          {request?.label} ({minLength}–500 characters)
        </label>
        <textarea
          id={fieldId}
          className="bantai-p-input"
          rows={4}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
