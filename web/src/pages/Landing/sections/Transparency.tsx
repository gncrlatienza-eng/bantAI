/* Public landing copy intentionally does not expose model performance or
 * versioning. Those operational metrics belong to the internal Admin portal. */
import React from 'react';
import { useReveal } from '../useReveal';
import './transparency.css';

export function Transparency() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section ref={rootRef} className="landing__section tp">
      <div className="landing__section-inner">
        <div className="tp__grid">
          <div className="tp__copy" data-reveal>
            <p className="landing__eyebrow">Privacy and review</p>
            <h2 className="landing__h2">
              Intelligence is reviewed before it is shared.
            </h2>
            <p className="landing__body">
              BantAI publishes campaign-level intelligence for Shield
              subscribers. Raw SMS, personal identifiers, training data, and
              model operations remain restricted.
            </p>
          </div>
          <div className="tp__panel" data-reveal data-reveal-delay="1">
            <div className="tp__panel-head">
              <span className="tp__panel-eyebrow">Published intelligence</span>
              <span className="tp__badge tp__badge--pending">Reviewed</span>
            </div>
            <div className="tp__skeleton">
              <div className="tp__skeleton-metric">
                <span className="tp__metric-label">Campaign activity</span>
                <span className="tp__skeleton-value">Shield</span>
              </div>
              <dl className="tp__meta tp__meta--placeholder">
                <dt>Data shared</dt>
                <dd>Campaign intelligence</dd>
                <dt>Data restricted</dt>
                <dd>Raw SMS and model operations</dd>
              </dl>
              <p className="tp__status">
                Shield receives finalized campaign patterns and approved
                indicators only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Transparency;
