/*
 * AuthLayout — one calm, product-focused sign-in surface.
 *
 * Desktop: two-column grid. The left panel stays mostly atmospheric — a
 * quiet inline-SVG network illustration in plum with tiny slate accents,
 * matching the landing page's editorial vector language. The auth card
 * sits on the right at ~68% horizontal, slightly above vertical center.
 *
 * Tablet: the illustration recedes and the card moves closer to centre.
 * Mobile: single column, full-width form, normal page padding.
 *
 * The layout is purposely NOT the old centered card — this file replaces
 * the AuthShell for the primary sign-in surface. The AuthShell is still
 * available for post-login flows (2FA) where a focused single card fits.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import './authlayout.css';

type DecorVariant = 'network' | 'paused';

interface AuthLayoutProps {
  children: React.ReactNode;
  /*
   * 'network' (default) — active cluster for the primary sign-in surface.
   * 'paused'            — quieter, dashed-outline cluster with an open
   *                       central node, used on the request-access page so
   *                       it reads as a sibling composition rather than a
   *                       clone of Sign In.
   */
  decor?: DecorVariant;
}

export function AuthLayout({ children, decor = 'network' }: AuthLayoutProps) {
  return (
    <div className="bantai-auth-layout" data-theme="mineral">
      <header className="bantai-auth-layout__header">
        <Link to="/" className="bantai-auth-layout__brand" aria-label="BantAI home">
          <span className="bantai-auth-layout__brand-mark" aria-hidden>
            <BrandMark />
          </span>
          <span className="bantai-auth-layout__brand-word">BantAI</span>
        </Link>
        <Link to="/" className="bantai-auth-layout__utility">
          Back to website
        </Link>
      </header>

      <main className="bantai-auth-layout__main">
        <div className="bantai-auth-layout__decor" aria-hidden>
          {decor === 'paused' ? <DecorPaused /> : <DecorNetwork />}
        </div>

        <div className="bantai-auth-layout__slot">{children}</div>
      </main>

      <footer className="bantai-auth-layout__footer">
        <span className="bantai-auth-layout__copy">
          © {new Date().getFullYear()} BantAI thesis project
        </span>
        <nav aria-label="Auth utility" className="bantai-auth-layout__utils">
          <a href="/#about">Privacy</a>
          <a href="/#about">Security</a>
          <a href="/#how-it-works">Help</a>
        </nav>
      </footer>
    </div>
  );
}

/*
 * BrandMark — small plum wordmark dot. Mirrors the portal sidebar mark
 * so the auth page feels like part of the same product surface, not a
 * separate marketing tile.
 */
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" role="presentation">
      <circle cx="12" cy="12" r="10" fill="var(--brand-primary)" />
      <circle cx="12" cy="12" r="3" fill="var(--surface-canvas)" />
    </svg>
  );
}

/*
 * DecorNetwork — sparse editorial network illustration. Twelve nodes
 * arranged in a loose asymmetric cluster, connected by thin dashed and
 * solid lines. Plum-dominant, with two small muted slate accents to hint
 * at "intelligence / connection" without leaning futuristic. Plenty of
 * negative space; nothing here should compete with the auth card.
 *
 * Rendered inline for the same reasons the landing SVGs are: sharp at
 * any resolution, colours bound to the cream/plum token system, no
 * raster asset to ship. viewBox is deliberately taller than wide so the
 * composition reads as a quiet column beside the form.
 */
function DecorNetwork() {
  return (
    <svg
      viewBox="0 0 520 720"
      className="bantai-auth-decor-svg"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
    >
      {/* Faint boundary ring — matches CampaignIntelligence cluster boundary */}
      <circle
        cx="270"
        cy="360"
        r="240"
        fill="none"
        stroke="var(--plum-14)"
        strokeDasharray="2 8"
      />
      <circle
        cx="270"
        cy="360"
        r="170"
        fill="none"
        stroke="var(--plum-08)"
        strokeDasharray="2 8"
      />

      {/* Connecting paths — a mix of dashed edges (like the landing cluster)
          and thin solid curves to break the monotony of straight lines. */}
      <g
        stroke="var(--plum-35)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      >
        <line x1="270" y1="360" x2="100" y2="200" strokeDasharray="3 6" />
        <line x1="270" y1="360" x2="420" y2="180" />
        <line x1="270" y1="360" x2="450" y2="360" strokeDasharray="3 6" />
        <line x1="270" y1="360" x2="410" y2="540" />
        <line x1="270" y1="360" x2="130" y2="560" strokeDasharray="3 6" />
        <line x1="270" y1="360" x2="80" y2="380" />
        <path d="M100 200 C 180 150, 340 130, 420 180" />
        <path d="M420 180 C 470 260, 470 320, 450 360" strokeDasharray="3 6" />
        <path d="M130 560 C 220 620, 340 620, 410 540" />
      </g>

      {/* Outer variant nodes — small hollow rings, occasional filled dot */}
      <g fill="var(--surface-canvas)" stroke="var(--plum-60)" strokeWidth="1">
        <circle cx="100" cy="200" r="6" />
        <circle cx="420" cy="180" r="6" />
        <circle cx="450" cy="360" r="6" />
        <circle cx="410" cy="540" r="6" />
        <circle cx="130" cy="560" r="6" />
        <circle cx="80" cy="380" r="6" />
      </g>
      {/* Interior dots for a handful of the nodes */}
      <g fill="var(--brand-primary)">
        <circle cx="100" cy="200" r="2.2" />
        <circle cx="450" cy="360" r="2.2" />
        <circle cx="130" cy="560" r="2.2" />
      </g>

      {/* Muted slate accents — two tiny secondary dots. Restrained blue,
          only present so the composition has one non-plum note. */}
      <circle cx="420" cy="180" r="2.4" fill="var(--auth-accent-slate)" />
      <circle cx="410" cy="540" r="2.4" fill="var(--auth-accent-slate)" />

      {/* Tiny satellite marks in the negative space — feel of a graph
          without turning the page into a hero visual */}
      <g fill="var(--plum-35)">
        <rect x="200" y="120" width="3" height="3" />
        <rect x="360" y="440" width="3" height="3" />
        <rect x="180" y="480" width="3" height="3" />
      </g>

      {/* Central node — a soft plum halo behind a small solid mark. Sits
          on the boundary between hero and background: never a focal point
          on its own, but anchors the whole composition. */}
      <g>
        <circle cx="270" cy="360" r="26" fill="var(--plum-08)" />
        <circle cx="270" cy="360" r="14" fill="var(--plum-14)" />
        <circle cx="270" cy="360" r="6" fill="var(--brand-primary)" />
      </g>
    </svg>
  );
}

/*
 * DecorPaused — a quieter sibling of DecorNetwork used on the request-access
 * page. Same visual vocabulary (dashed boundary rings, thin plum edges,
 * small ringed nodes) but every edge is dashed, the central node is hollow
 * instead of filled, and the two slate accent dots are removed. Reads as
 * "not connected yet" rather than "active network".
 */
function DecorPaused() {
  return (
    <svg
      viewBox="0 0 520 720"
      className="bantai-auth-decor-svg"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
    >
      <circle
        cx="270"
        cy="360"
        r="240"
        fill="none"
        stroke="var(--plum-14)"
        strokeDasharray="2 8"
      />
      <circle
        cx="270"
        cy="360"
        r="170"
        fill="none"
        stroke="var(--plum-08)"
        strokeDasharray="2 8"
      />

      {/* Every edge is dashed — nothing is "wired up" yet. */}
      <g
        stroke="var(--plum-35)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="3 6"
      >
        <line x1="270" y1="360" x2="100" y2="200" />
        <line x1="270" y1="360" x2="420" y2="180" />
        <line x1="270" y1="360" x2="450" y2="360" />
        <line x1="270" y1="360" x2="410" y2="540" />
        <line x1="270" y1="360" x2="130" y2="560" />
        <line x1="270" y1="360" x2="80" y2="380" />
      </g>

      {/* Outer nodes — all hollow rings, no filled dots. */}
      <g fill="var(--surface-canvas)" stroke="var(--plum-60)" strokeWidth="1">
        <circle cx="100" cy="200" r="6" />
        <circle cx="420" cy="180" r="6" />
        <circle cx="450" cy="360" r="6" />
        <circle cx="410" cy="540" r="6" />
        <circle cx="130" cy="560" r="6" />
        <circle cx="80" cy="380" r="6" />
      </g>

      <g fill="var(--plum-35)">
        <rect x="200" y="120" width="3" height="3" />
        <rect x="360" y="440" width="3" height="3" />
        <rect x="180" y="480" width="3" height="3" />
      </g>

      {/* Central node — hollow with a soft plum halo. Nothing lit inside. */}
      <g>
        <circle cx="270" cy="360" r="26" fill="var(--plum-08)" />
        <circle
          cx="270"
          cy="360"
          r="14"
          fill="var(--surface-canvas)"
          stroke="var(--plum-60)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      </g>
    </svg>
  );
}

export default AuthLayout;
