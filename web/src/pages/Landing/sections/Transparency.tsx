/*
 * Transparency section.
 *
 * Pulls the public model summary from GET /models/public-summary. When the
 * endpoint returns null or fails, the panel renders a proper "no data yet"
 * state (skeleton rows + honest copy) — never a fabricated number. If a real
 * model exists, we show the live macro-F1, accuracy, active version, and
 * promotion date.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  getPublicModelSummary,
  type PublicModelSummary,
} from '../../../services/modelsService';
import { useReveal } from '../useReveal';
import './transparency.css';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Transparency() {
  const [summary, setSummary] = useState<PublicModelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setSummary(await getPublicModelSummary());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasNumber = summary?.macroF1 != null;
  const rootRef = useReveal<HTMLElement>();

  return (
    <section ref={rootRef} className="landing__section tp">
      <div className="landing__section-inner">
        <div className="tp__grid">
          <div className="tp__copy" data-reveal>
            <p className="landing__eyebrow">Transparency</p>
            <h2 className="landing__h2">
              Measured, reviewable, and transparent.
            </h2>
            <p className="landing__body">
              The active model version and its held-out evaluation live here so
              accuracy claims can be checked against the running system.
              Confusion matrices, per-class breakdowns, and drift signals sit
              inside the portal for signed-in reviewers.
            </p>
          </div>

          <div className="tp__panel" aria-live="polite" data-reveal data-reveal-delay="1">
            <div className="tp__panel-head">
              <span className="tp__panel-eyebrow">Public model summary</span>
              <span
                className={`tp__badge${
                  hasNumber ? ' tp__badge--live' : ' tp__badge--pending'
                }`}
              >
                {hasNumber ? 'Live' : 'Not yet published'}
              </span>
            </div>

            {loading ? (
              <TpSkeleton note="Loading…" />
            ) : failed ? (
              <TpSkeleton note="Endpoint unavailable. Numbers are hidden rather than substituted." />
            ) : !hasNumber ? (
              <TpSkeleton note="No evaluated model version has been promoted yet. Macro-F1, accuracy, and the active version tag will appear here automatically once the first version is published." />
            ) : (
              <>
                <div className="tp__metric">
                  <span className="tp__metric-label">Macro-F1</span>
                  <span className="tp__metric-value">
                    {summary!.macroF1!.toFixed(3)}
                  </span>
                </div>
                {summary!.accuracy != null && (
                  <div className="tp__metric tp__metric--sub">
                    <span className="tp__metric-label">Accuracy</span>
                    <span className="tp__metric-value tp__metric-value--sub">
                      {summary!.accuracy.toFixed(3)}
                    </span>
                  </div>
                )}
                <dl className="tp__meta">
                  {summary!.versionTag && (
                    <>
                      <dt>Active version</dt>
                      <dd>{summary!.versionTag}</dd>
                    </>
                  )}
                  {summary!.promotedAt && (
                    <>
                      <dt>Promoted</dt>
                      <dd>{formatDate(summary!.promotedAt)}</dd>
                    </>
                  )}
                </dl>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * TpSkeleton — a proper unavailable-data state. Shows the shape of the panel
 * (label + big number + secondary metric + meta rows) with dashed placeholders
 * so the reader understands what would appear once real data is published. No
 * shimmer animation — the point is honesty, not a fake loading state.
 */
function TpSkeleton({ note }: { note: string }) {
  return (
    <div className="tp__skeleton">
      <div className="tp__skeleton-metric">
        <span className="tp__metric-label">Macro-F1</span>
        <span className="tp__skeleton-value">—</span>
      </div>
      <div className="tp__skeleton-metric tp__skeleton-metric--sub">
        <span className="tp__metric-label">Accuracy</span>
        <span className="tp__skeleton-value tp__skeleton-value--sub">—</span>
      </div>
      <dl className="tp__meta tp__meta--placeholder">
        <dt>Active version</dt>
        <dd>—</dd>
        <dt>Promoted</dt>
        <dd>—</dd>
      </dl>
      <p className="tp__status">{note}</p>
    </div>
  );
}

export default Transparency;
