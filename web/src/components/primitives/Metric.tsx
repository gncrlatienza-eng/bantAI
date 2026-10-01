import React from 'react';

/*
 * Metric renders a KPI as label + big number + optional meta line.
 * No card wrapper by default (per Section 14 "Avoid card soup"). Compose
 * with a wrapper only when the metric belongs to a contained unit.
 *
 * Color is intentionally neutral. Threat volume or safe volume is conveyed
 * by the label ("Likely smishing"), not by the number's color. Same rule
 * that keeps confidence neutral applies here.
 */

interface MetricProps {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
}

export function Metric({ label, value, meta }: MetricProps) {
  return (
    <div className="bantai-p-metric">
      <p className="bantai-p-metric__label">{label}</p>
      <p className="bantai-p-metric__value">{value}</p>
      {meta && <p className="bantai-p-metric__meta">{meta}</p>}
    </div>
  );
}

/*
 * MetricRow is a thin grid wrapper for aligning KPIs in a row. Uses tokens
 * for the gap. `columns` is the wide-screen count; on narrow screens the row
 * reflows (see .bantai-p-metric-row in primitives.css). It is passed as a CSS
 * variable rather than an inline grid template because an inline template
 * can't be overridden by a media query, which squeezed four metrics into
 * ~70px each at phone width.
 */
interface MetricRowProps {
  columns?: number;
  children: React.ReactNode;
}

export function MetricRow({ columns = 4, children }: MetricRowProps) {
  return (
    <div
      className="bantai-p-metric-row"
      style={{ '--metric-columns': columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
