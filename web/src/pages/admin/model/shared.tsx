import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button, Dialog } from '../../../components/primitives';

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
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

export function SectionHeader({
  id,
  title,
  description,
  actions,
}: {
  id?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 12,
      }}
    >
      <div>
        <h2 id={id} style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {title}
        </h2>
        {description && (
          <p
            style={{
              ...MUTED,
              margin: '4px 0 0',
              fontSize: '0.9rem',
              maxWidth: '70ch',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

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
