/*
 * Campaign Intelligence — first plum-background surface.
 *
 * Two-column layout inside the plum band: a labeled Swiss/editorial cluster
 * graph on the left and a metadata panel on the right that names the
 * campaign, its dominant lure, top domains, and observation window. The
 * graph makes distinct affordances for SMS variant nodes vs domain nodes and
 * annotates the edge that represents an evolutionary variant.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import './campaign-intelligence.css';

export function CampaignIntelligence() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section ref={rootRef} className="landing__section landing__section--plum ci">
      <div className="landing__section-inner">
        <div className="ci__intro" data-reveal>
          <p className="landing__eyebrow">Campaign intelligence</p>
          <h2 className="landing__h2">
            Threats change. Campaign context persists.
          </h2>
          <p className="landing__lede">
            Wording drifts and domains rotate. What survives across variants
            is the campaign identity — that's what BantAI tracks.
          </p>
        </div>

        <div className="ci__grid">
          <div className="ci__stage" aria-hidden data-reveal data-reveal-delay="1">
            <ClusterGraph />

            <div className="ci__legend" aria-hidden>
              <div className="ci__legend-item">
                <span className="ci__legend-swatch ci__legend-swatch--node" />
                SMS variant
              </div>
              <div className="ci__legend-item">
                <span className="ci__legend-swatch ci__legend-swatch--domain" />
                Domain
              </div>
              <div className="ci__legend-item">
                <span className="ci__legend-swatch ci__legend-swatch--edge" />
                Semantic edge
              </div>
              <div className="ci__legend-item">
                <span className="ci__legend-swatch ci__legend-swatch--edge-evo" />
                New variant
              </div>
            </div>
          </div>

          <aside className="ci__panel" aria-label="Campaign PH-023 summary" data-reveal data-reveal-delay="2">
            <p className="ci__panel-label">Campaign detail</p>
            <p className="ci__panel-id">PH-023</p>
            <h3 className="ci__panel-title">
              E-wallet account-suspension lure
            </h3>
            <p className="ci__panel-body">
              A multilingual smishing family targeting BDO and GCash customers
              with an urgency framing and a rotating set of look-alike domains.
            </p>

            <dl className="ci__meta">
              <div>
                <dt>Variants</dt>
                <dd>12</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>EN · TL · TAG</dd>
              </div>
              <div>
                <dt>First seen</dt>
                <dd>Sep 04</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>Sep 20</dd>
              </div>
            </dl>

            <p className="ci__panel-label ci__panel-label--sub">Top domains</p>
            <ul className="ci__domain-list">
              <li>bdo-secure.link</li>
              <li>bdo-verify.ph</li>
              <li>gcash-help.link</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

/*
 * ClusterGraph — 620×420 viewBox. Central campaign node with five SMS variant
 * nodes and three domain nodes. Each SMS node is a rectangular chip labeled
 * with a similarity score; each domain node is a small pin with the URL host
 * inline. One edge highlights an evolutionary "new variant" join.
 */
function ClusterGraph() {
  return (
    <svg
      viewBox="0 0 620 420"
      className="ci-graph"
      role="img"
      aria-label="Cluster graph showing five SMS variant nodes connected to campaign PH-023 via semantic-similarity edges, with three related domains attached to the outer variants."
    >
      {/* Cluster boundary */}
      <circle
        cx="310"
        cy="210"
        r="196"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeDasharray="2 6"
      />
      <text
        x="310"
        y="18"
        fontSize="9"
        fill="rgba(255,255,255,0.6)"
        letterSpacing="0.16em"
        textAnchor="middle"
        fontFamily="var(--font-mono, monospace)"
      >
        CAMPAIGN BOUNDARY
      </text>

      {/* Edges */}
      <g stroke="rgba(255,255,255,0.5)" strokeWidth="1.1" strokeLinecap="round">
        <line x1="310" y1="210" x2="140" y2="130" />
        <line x1="310" y1="210" x2="480" y2="130" />
        <line x1="310" y1="210" x2="140" y2="300" />
        <line x1="310" y1="210" x2="480" y2="300" />
      </g>
      {/* Evolutionary edge — dashed, brighter */}
      <line
        x1="310"
        y1="210"
        x2="560"
        y2="220"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />

      {/* Domain sub-edges */}
      <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.9" strokeLinecap="round">
        <line x1="140" y1="130" x2="60" y2="70" />
        <line x1="480" y1="130" x2="560" y2="70" />
        <line x1="140" y1="300" x2="60" y2="360" />
      </g>

      {/* Variant nodes */}
      <VariantNode x={110} y={112} lang="EN" sim="0.94" />
      <VariantNode x={450} y={112} lang="TL" sim="0.91" />
      <VariantNode x={110} y={282} lang="TAG" sim="0.92" />
      <VariantNode x={450} y={282} lang="EN" sim="0.89" />
      <VariantNode x={530} y={202} lang="TL" sim="0.87" evolution />

      {/* Domain pins */}
      <DomainPin cx={60} cy={70} label="bdo-secure.link" align="start" />
      <DomainPin cx={560} cy={70} label="bdo-verify.ph" align="end" />
      <DomainPin cx={60} cy={360} label="gcash-help.link" align="start" />

      {/* Center campaign node */}
      <g>
        <circle cx="310" cy="210" r="46" fill="rgba(255,255,255,0.08)" />
        <circle cx="310" cy="210" r="34" fill="rgba(255,255,255,0.98)" />
        <text
          x="310"
          y="204"
          fontSize="10"
          fill="var(--text-secondary)"
          textAnchor="middle"
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
        >
          CAMPAIGN
        </text>
        <text
          x="310"
          y="222"
          fontSize="15"
          fill="var(--brand-primary)"
          textAnchor="middle"
          fontWeight="700"
          fontFamily="var(--font-mono, monospace)"
        >
          PH-023
        </text>
      </g>
    </svg>
  );
}

function VariantNode({
  x,
  y,
  lang,
  sim,
  evolution = false,
}: {
  x: number;
  y: number;
  lang: string;
  sim: string;
  evolution?: boolean;
}) {
  return (
    <g className={evolution ? 'ci-node ci-node--evo' : 'ci-node'}>
      <rect
        x={x - 40}
        y={y - 20}
        width="80"
        height="40"
        rx="4"
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.7)"
      />
      <rect
        x={x - 32}
        y={y - 12}
        width="20"
        height="12"
        rx="2"
        fill="rgba(255,255,255,0.14)"
        stroke="rgba(255,255,255,0.6)"
      />
      <text
        x={x - 22}
        y={y - 3}
        fontSize="7.5"
        fill="rgba(255,255,255,0.94)"
        textAnchor="middle"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
      >
        {lang}
      </text>
      <text
        x={x + 32}
        y={y - 2}
        fontSize="9"
        fill="rgba(255,255,255,0.9)"
        textAnchor="end"
        fontFamily="var(--font-mono, monospace)"
        fontWeight="600"
      >
        {sim}
      </text>
      <text
        x={x - 32}
        y={y + 14}
        fontSize="7.5"
        fill="rgba(255,255,255,0.65)"
        letterSpacing="0.1em"
        fontFamily="var(--font-mono, monospace)"
      >
        SMS
      </text>
      {evolution && (
        <text
          x={x + 32}
          y={y + 14}
          fontSize="7"
          fill="rgba(255,255,255,0.95)"
          textAnchor="end"
          letterSpacing="0.12em"
          fontFamily="var(--font-mono, monospace)"
        >
          NEW
        </text>
      )}
    </g>
  );
}

function DomainPin({
  cx,
  cy,
  label,
  align,
}: {
  cx: number;
  cy: number;
  label: string;
  align: 'start' | 'end';
}) {
  const anchor = align === 'end' ? 'end' : 'start';
  const tx = align === 'end' ? cx + 8 : cx - 8;
  return (
    <g>
      <rect x={cx - 3} y={cy - 3} width="6" height="6" fill="rgba(255,255,255,0.9)" />
      <text
        x={tx}
        y={cy + 3}
        fontSize="9"
        fill="rgba(255,255,255,0.85)"
        textAnchor={anchor}
        fontFamily="var(--font-mono, monospace)"
      >
        {label}
      </text>
    </g>
  );
}

export default CampaignIntelligence;
