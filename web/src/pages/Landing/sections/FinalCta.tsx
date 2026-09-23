/*
 * Final CTA. Plum surface. The backdrop reuses the campaign-cluster motif
 * introduced earlier — a muted, static cluster graph radiating out from a
 * central node behind the copy. Signals the site's recurring visual language
 * instead of introducing a new decoration.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../useReveal';
import './final-cta.css';

export function FinalCta() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section ref={rootRef} className="landing__section landing__section--plum fc">
      <div className="fc__backdrop" aria-hidden>
        <FcClusterBackdrop />
      </div>

      <div className="landing__section-inner fc__inner">
        <h2 className="landing__h2" data-reveal>Ready to explore BantAI?</h2>
        <p className="landing__lede" data-reveal data-reveal-delay="1">
          Access the platform for testing, research, or project evaluation.
        </p>

        <div className="landing__cta-row fc__actions" data-reveal data-reveal-delay="2">
          <Link to="/request-access" className="fc__cta-primary">
            Request access →
          </Link>
          <Link to="/login" className="fc__cta-signin">
            Already have access? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/*
 * FcClusterBackdrop — a scaled-down, low-contrast rendition of the campaign
 * cluster from CampaignIntelligence. Nine variant nodes and a central
 * campaign node, connected by thin dashed edges. Motion is a single, slow
 * ambient breathing pulse on the center — no per-node drift.
 */
function FcClusterBackdrop() {
  const nodes = [
    { x: 220, y: 120 },
    { x: 380, y: 100 },
    { x: 540, y: 140 },
    { x: 700, y: 190 },
    { x: 720, y: 320 },
    { x: 560, y: 380 },
    { x: 400, y: 400 },
    { x: 240, y: 360 },
    { x: 180, y: 240 },
  ];

  return (
    <svg
      viewBox="0 0 960 480"
      preserveAspectRatio="xMidYMid slice"
      className="fc-svg"
      role="img"
      aria-label=""
    >
      {/* Cluster boundary ring */}
      <circle
        cx="480"
        cy="240"
        r="220"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeDasharray="2 8"
      />

      {/* Edges from center to each node */}
      <g
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
        strokeDasharray="2 6"
        strokeLinecap="round"
      >
        {nodes.map((n, i) => (
          <line key={i} x1="480" y1="240" x2={n.x} y2={n.y} />
        ))}
      </g>

      {/* Variant nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r="8"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.4)"
          />
          <circle cx={n.x} cy={n.y} r="1.6" fill="rgba(255,255,255,0.7)" />
        </g>
      ))}

      {/* Central campaign mark — softly pulsing */}
      <g className="fc__center">
        <circle cx="480" cy="240" r="54" fill="rgba(255,255,255,0.06)" />
        <circle cx="480" cy="240" r="38" fill="rgba(255,255,255,0.12)" />
        <circle cx="480" cy="240" r="22" fill="rgba(255,255,255,0.22)" />
      </g>
    </svg>
  );
}

export default FinalCta;
