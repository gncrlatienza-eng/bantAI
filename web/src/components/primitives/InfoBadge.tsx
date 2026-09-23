import React from 'react';
import { InfoIcon } from './icons';

/*
 * InfoBadge marks AI-generated insight, model metadata, or analytical output.
 * Uses --info-fg (Petrol). Never for brand, threat, or classification.
 */

interface InfoBadgeProps {
  children: React.ReactNode;
  glyph?: React.ReactNode;
  title?: string;
}

export function InfoBadge({
  children,
  glyph = <InfoIcon />,
  title,
}: InfoBadgeProps) {
  return (
    <span className="bantai-p-info" title={title}>
      <span className="bantai-p-info__icon" aria-hidden>
        {glyph}
      </span>
      <span>{children}</span>
    </span>
  );
}
