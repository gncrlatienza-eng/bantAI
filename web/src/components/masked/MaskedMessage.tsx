import React from 'react';

/*
 * Renders privacy-masked SMS text (backend sms-privacy-masker.ts output) with
 * the redaction placeholders shown as chips, so reviewers can tell at a glance
 * what was hidden: [URL] [EMAIL] [PHONE] [AMOUNT] [OTP] [NUMBER], plus the
 * [NAME]/[BRAND]-style tokens admins use in approved Shield examples.
 *
 * The text is already masked server-side; this component never unmasks or
 * re-derives anything, it only styles the placeholders.
 */

const TOKEN_SPLIT = /(\[[A-Z_]{2,16}\])/;
const IS_TOKEN = /^\[[A-Z_]{2,16}\]$/;

const chipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 5px',
  margin: '0 1px',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78em',
  lineHeight: 1.5,
  background: 'var(--surface-selected)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  whiteSpace: 'nowrap',
};

interface MaskedMessageProps {
  text: string | null | undefined;
  /** Truncate to this many characters (table cells). */
  maxLength?: number;
  emptyLabel?: string;
}

export function MaskedMessage({
  text,
  maxLength,
  emptyLabel = 'Message unavailable',
}: MaskedMessageProps) {
  if (!text) {
    return (
      <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        {emptyLabel}
      </span>
    );
  }
  const shown =
    maxLength && text.length > maxLength
      ? `${text.slice(0, maxLength).trimEnd()}…`
      : text;
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {shown.split(TOKEN_SPLIT).map((part, i) =>
        IS_TOKEN.test(part) ? (
          <span key={i} style={chipStyle} title="Redacted for privacy">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}

export default MaskedMessage;
