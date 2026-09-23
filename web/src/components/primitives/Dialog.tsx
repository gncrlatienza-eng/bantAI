import React from 'react';

/*
 * Dialog: modal with backdrop, Escape-to-close, focus trap, and focus restoration.
 *
 * Used for destructive confirmations per Section 26. The confirmation button
 * inside is a <Button variant="destructive-confirm">, which is the escalated
 * carmine background variant. The initial button on the source page stays
 * neutral until the dialog is opened.
 *
 * Not for lightweight informational messages. Use Toast (later batch) for
 * transient acknowledgments. Not for major page-level errors. Use ErrorState.
 */

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  actions,
  initialFocusRef,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    previousActiveElement.current =
      document.activeElement as HTMLElement | null;

    const focusTarget =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      dialogRef.current;
    focusTarget?.focus();

    return () => {
      previousActiveElement.current?.focus();
    };
  }, [open, initialFocusRef]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('inert'));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bantai-p-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bantai-p-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="bantai-p-dialog__title">
          {title}
        </h2>
        {description && (
          <p id={descId} className="bantai-p-dialog__description">
            {description}
          </p>
        )}
        {children}
        {actions && <div className="bantai-p-dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}
