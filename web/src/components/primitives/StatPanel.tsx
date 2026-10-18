import React from 'react';

export interface PanelFact {
  label: string;
  value: React.ReactNode;
}

/*
 * The framed summary at the top of a screen: headline numbers (a MetricRow),
 * an optional status line — only when the state needs attention or confirms
 * something the numbers don't — small facts that aren't worth a big number,
 * and an aside for the screen's help or summary actions. Every screen's
 * numbers sit in one of these so no stat row floats on the canvas.
 * Styles live in appshell.css (.bantai-statpanel).
 */
export function StatPanel({
  label,
  status,
  facts,
  aside,
  children,
}: {
  label: string;
  status?: { tone: 'ok' | 'warn'; text: React.ReactNode };
  facts?: PanelFact[];
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hasFooter = Boolean(facts?.length || aside);
  return (
    <section className="bantai-statpanel" aria-label={label}>
      {status && (
        <p
          className="bantai-statpanel__status"
          data-tone={status.tone}
          role="status"
        >
          <span className="bantai-statpanel__dot" aria-hidden />
          {status.text}
        </p>
      )}
      <div className="bantai-statpanel__metrics">{children}</div>
      {hasFooter && (
        <div className="bantai-statpanel__footer">
          {facts?.length ? (
            <dl className="bantai-statpanel__facts">
              {facts.map((fact) => (
                <div key={fact.label} className="bantai-statpanel__fact">
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <span />
          )}
          {aside && <div className="bantai-statpanel__aside">{aside}</div>}
        </div>
      )}
    </section>
  );
}

export default StatPanel;
