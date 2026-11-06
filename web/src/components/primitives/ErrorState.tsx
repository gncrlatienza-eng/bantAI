import React from 'react';
import { ErrorIcon } from './icons';

/*
 * ErrorState is intentionally scoped: a whole-page or whole-section failure.
 * Per Section 28, do NOT replace the entire dashboard with an error page when
 * only one subsystem failed. Prefer targeted inline messages there.
 */

interface ErrorStateProps {
  title: string;
  description?: string;
  glyph?: React.ReactNode;
  action?: React.ReactNode;
}

export function ErrorState({
  title,
  description,
  glyph = <ErrorIcon />,
  action,
}: ErrorStateProps) {
  return (
    <div className="bantai-p-errorstate" role="alert">
      <span className="bantai-p-errorstate__icon" aria-hidden>
        {glyph}
      </span>
      <h3 className="bantai-p-errorstate__title">{title}</h3>
      {description && (
        <p className="bantai-p-errorstate__description">{description}</p>
      )}
      {action && <div className="bantai-p-errorstate__action">{action}</div>}
    </div>
  );
}
