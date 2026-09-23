import React from 'react';
import { EmptyIcon } from './icons';

/*
 * EmptyState: single-icon plus one line of copy plus one optional action.
 * Div-based fake illustrations are banned per taste rules; use a real glyph
 * or a real generated image if the state deserves more visual weight.
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  glyph?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  glyph = <EmptyIcon />,
  action,
}: EmptyStateProps) {
  return (
    <div className="bantai-p-empty" role="status">
      <span className="bantai-p-empty__icon" aria-hidden>
        {glyph}
      </span>
      <h3 className="bantai-p-empty__title">{title}</h3>
      {description && (
        <p className="bantai-p-empty__description">{description}</p>
      )}
      {action && <div className="bantai-p-empty__action">{action}</div>}
    </div>
  );
}
