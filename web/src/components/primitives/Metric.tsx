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
 * for the gap; the caller sets template via inline style or CSS class.
 */
interface MetricRowProps {
  columns?: number;
  children: React.ReactNode;
}

export function MetricRow({ columns = 4, children }: MetricRowProps) {
  return (
    <div
      className="bantai-p-metric-row"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
