import React from 'react';
import {
  UnknownIcon,
  VerifiedIcon,
  SuspiciousIcon,
  ThreatIcon,
  CriticalIcon,
} from './icons';

/*
 * StatusBadge is the single source of truth for classification presentation.
 *
 * Rules (enforced in review):
 *   - Color, icon, and label appear together. Never color alone.
 *   - `kind` maps to classification only. Never derive from confidence.
 *   - "Critical" is used only when the backend formally defines that severity.
 *     If the domain layer does not distinguish critical from threat, do not
 *     use kind="critical". Fall back to kind="threat".
 *   - "Unknown" means insufficient conclusion, NOT safe. Visually distinct
 *     from "verified".
 */

export type StatusKind =
  'unknown' | 'verified' | 'suspicious' | 'threat' | 'critical';

const DEFAULT_LABEL: Record<StatusKind, string> = {
  unknown: 'Unknown',
  verified: 'Verified',
  suspicious: 'Suspicious',
  threat: 'Likely Smishing',
  critical: 'Critical',
};

const DEFAULT_ICON: Record<StatusKind, React.ReactNode> = {
  unknown: <UnknownIcon />,
  verified: <VerifiedIcon />,
  suspicious: <SuspiciousIcon />,
  threat: <ThreatIcon />,
  critical: <CriticalIcon />,
};

interface StatusBadgeProps {
  kind: StatusKind;
  label?: string;
  glyph?: React.ReactNode;
  solid?: boolean;
  title?: string;
}

export function StatusBadge({
  kind,
  label,
  glyph,
  solid = false,
  title,
}: StatusBadgeProps) {
  const resolvedLabel = label ?? DEFAULT_LABEL[kind];
  const resolvedGlyph = glyph ?? DEFAULT_ICON[kind];
  const classes = [
    'bantai-p-status',
    `bantai-p-status--${kind}`,
    solid && 'bantai-p-status--solid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      title={title ?? resolvedLabel}
      role="status"
      aria-label={resolvedLabel}
    >
      <span className="bantai-p-status__icon" aria-hidden>
        {resolvedGlyph}
      </span>
      <span>{resolvedLabel}</span>
    </span>
  );
}
