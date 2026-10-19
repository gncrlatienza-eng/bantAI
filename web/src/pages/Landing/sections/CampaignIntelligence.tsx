/*
 * Campaign Intelligence: a white band on the platform page.
 *
 * Two-column layout inside the plum band: a labeled Swiss/editorial cluster
 * graph on the left and a metadata panel on the right that names the
 * campaign, its dominant lure, top domains, and observation window. The
 * graph makes distinct affordances for SMS variant nodes vs domain nodes and
 * annotates the edge that represents an evolutionary variant.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import {
  DEMO_CAMPAIGN,
  DEMO_VARIANTS,
  VARIANT_COUNT,
  langTag,
} from '../landingFixture';

const DOMAINS = [...new Set(DEMO_VARIANTS.map((v) => v.domain))].slice(0, 3);
const NODE_POSITIONS: Array<[number, number]> = [
  [110, 112],
  [450, 112],
  [110, 282],
  [450, 282],
  [530, 202],
];
const PIN_POSITIONS: Array<[number, number, 'start' | 'end']> = [
  [60, 70, 'start'],
  [560, 70, 'end'],
  [60, 360, 'start'],
];
import './campaign-intelligence.css';

export function CampaignIntelligence() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section ref={rootRef} className="landing__section ci">
      <div className="landing__section-inner">
        <div className="ci__intro" data-reveal>
          <p className="landing__eyebrow">Campaign intelligence</p>
          <h2 className="landing__h2">
            Threats change. Campaign context persists.
          </h2>
          <p className="landing__lede">
            Wording drifts and domains rotate. What survives across variants is
            the campaign identity, and that&apos;s what BantAI tracks.
          </p>
        </div>

        <div className="ci__grid">
          <div
            className="ci__stage"
            aria-hidden
            data-reveal
            data-reveal-delay="1"
          >
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

          <aside
            className="ci__panel"
            aria-label="Illustrative campaign example"
            data-reveal
            data-reveal-delay="2"
          >
            <p className="ci__panel-label">Illustrative campaign example</p>
            <p className="ci__panel-id">{DEMO_CAMPAIGN.category}</p>
            <h3 className="ci__panel-title">{DEMO_CAMPAIGN.label}</h3>
            <p className="ci__panel-body">
              {DEMO_CAMPAIGN.summary} Urgent framing and a rotating set of
              look-alike domains.
            </p>

            <dl className="ci__meta">
              <div>
                <dt>Variants</dt>
                <dd>{VARIANT_COUNT}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>
                  {(['en', 'fil', 'mixed'] as const).map(langTag).join(' · ')}
                </dd>
              </div>
              <div>
                <dt>First seen</dt>
                <dd>{DEMO_CAMPAIGN.firstSeen}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{DEMO_CAMPAIGN.lastSeen}</dd>
              </div>
            </dl>

            <p className="ci__panel-label ci__panel-label--sub">Top domains</p>
            <ul className="ci__domain-list">
              {DOMAINS.map((d) => (
                <li key={d}>{d}</li>
              ))}
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
      aria-label={`Cluster graph: five of the campaign's ${VARIANT_COUNT} SMS variants, in English, Filipino, and Taglish, linked to one GCash campaign by similarity, with three shared look-alike domains.`}
    >
      {/* Cluster boundary */}
      <circle
        cx="310"
        cy="210"
        r="196"
        fill="none"
        stroke="rgba(94,64,90,0.28)"
        strokeDasharray="2 6"
      />
      <text
        x="310"
        y="18"
        fontSize="13"
        fill="var(--text-secondary)"
        letterSpacing="0.16em"
        textAnchor="middle"
        fontFamily="var(--font-mono, monospace)"
      >
        CAMPAIGN BOUNDARY
      </text>

      {/* Edges */}
      <g stroke="rgba(94,64,90,0.4)" strokeWidth="1.1" strokeLinecap="round">
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
        stroke="rgba(94,64,90,0.75)"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />

      {/* Domain sub-edges */}
      <g stroke="rgba(94,64,90,0.22)" strokeWidth="0.9" strokeLinecap="round">
        <line x1="140" y1="130" x2="60" y2="70" />
        <line x1="480" y1="130" x2="560" y2="70" />
        <line x1="140" y1="300" x2="60" y2="360" />
      </g>

      {/* Variant nodes */}
      {DEMO_VARIANTS.slice(0, 5).map((v, i) => {
        const [x, y] = NODE_POSITIONS[i];
        return (
          <VariantNode
            key={v.id}
            x={x}
            y={y}
            lang={langTag(v.lang)}
            sim={v.similarity.toFixed(2)}
            evolution={i === 4}
          />
        );
      })}

      {/* Domain pins */}
      {DOMAINS.map((d, i) => {
        const [cx, cy, align] = PIN_POSITIONS[i];
        return <DomainPin key={d} cx={cx} cy={cy} label={d} align={align} />;
      })}

      {/* Center campaign node */}
      <g>
        <circle cx="310" cy="210" r="58" fill="rgba(94,64,90,0.07)" />
        <circle
          cx="310"
          cy="210"
          r="46"
          fill="#ffffff"
          stroke="rgba(94,64,90,0.3)"
        />
        <text
          x="310"
          y="198"
          fontSize="13"
          fill="var(--text-secondary)"
          textAnchor="middle"
          letterSpacing="0.08em"
          fontFamily="var(--font-mono, monospace)"
        >
          CAMPAIGN
        </text>
        <text
          x="310"
          y="228"
          fontSize="18"
          fill="var(--brand-primary)"
          textAnchor="middle"
          fontWeight="700"
          fontFamily="var(--font-mono, monospace)"
        >
          GCash
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
  // Sized so labels render >= 12px wherever the graph is shown (>= 0.94x
  // above 720px; labels are hidden below that, see campaign-intelligence.css).
  const badgeWidth = lang.length * 8 + 12;
  return (
    <g className={evolution ? 'ci-node ci-node--evo' : 'ci-node'}>
      <rect
        x={x - 60}
        y={y - 24}
        width="120"
        height="48"
        rx="6"
        fill="#ffffff"
        stroke="rgba(94,64,90,0.35)"
      />
      <rect
        x={x - 52}
        y={y - 16}
        width={badgeWidth}
        height="18"
        rx="3"
        fill="rgba(94,64,90,0.08)"
        stroke="rgba(94,64,90,0.3)"
      />
      <text
        x={x - 52 + badgeWidth / 2}
        y={y - 3}
        fontSize="13"
        fill="var(--text-primary)"
        textAnchor="middle"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
      >
        {lang}
      </text>
      <text
        x={x + 52}
        y={y - 3}
        fontSize="13"
        fill="var(--text-primary)"
        textAnchor="end"
        fontFamily="var(--font-mono, monospace)"
        fontWeight="600"
      >
        {sim}
      </text>
      {evolution && (
        <text
          x={x + 52}
          y={y + 17}
          fontSize="13"
          fill="var(--brand-primary)"
          textAnchor="end"
          letterSpacing="0.08em"
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
  // Label sits beside the pin, never on top of it.
  const tx = align === 'end' ? cx - 8 : cx + 8;
  return (
    <g>
      <rect
        x={cx - 3}
        y={cy - 3}
        width="6"
        height="6"
        fill="var(--brand-primary)"
      />
      <text
        x={tx}
        y={cy + 3}
        fontSize="13"
        fill="var(--text-secondary)"
        textAnchor={anchor}
        fontFamily="var(--font-mono, monospace)"
      >
        {label}
      </text>
    </g>
  );
}

export default CampaignIntelligence;
