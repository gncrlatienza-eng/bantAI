import React from 'react';

/*
 * ConfidenceMeter renders classifier confidence as a neutral number + bar.
 *
 * Rules (enforced in review):
 *   - Never map value to hue, brightness, or saturation.
 *   - The fill color is --text-secondary regardless of value or associated
 *     classification. Threat vs. verified is expressed by StatusBadge, not here.
 *   - `value` is a fraction in [0, 1] OR a percentage in [0, 100].
 *     Auto-detected below.
 */

interface ConfidenceMeterProps {
  value: number;
  label?: string;
  showBar?: boolean;
  compact?: boolean;
}

function normalize(value: number): number {
  if (Number.isNaN(value)) return 0;
  const asPercent = value > 1 ? value : value * 100;
  return Math.max(0, Math.min(100, asPercent));
}

export function ConfidenceMeter({
  value,
  label = 'Confidence',
  showBar = true,
  compact = false,
}: ConfidenceMeterProps) {
  const pct = normalize(value);
  const display = pct.toFixed(pct >= 10 ? 0 : 1);

  const classes = `bantai-p-confidence${
    compact ? ' bantai-p-confidence--compact' : ''
  }`;

  const trackEl = showBar ? (
    <span className="bantai-p-confidence__track" aria-hidden>
      <span
        className="bantai-p-confidence__fill"
        style={{ width: `${pct}%` }}
      />
    </span>
  ) : null;

  const valueEl = (
    <span className="bantai-p-confidence__row">
      {!compact && <span className="bantai-p-confidence__label">{label}</span>}
      <span className="bantai-p-confidence__value">{display}%</span>
    </span>
  );

  return (
    <span
      className={classes}
      role="meter"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {compact ? (
        <>
          {trackEl}
          {valueEl}
        </>
      ) : (
        <>
          {valueEl}
          {trackEl}
        </>
      )}
    </span>
  );
}
