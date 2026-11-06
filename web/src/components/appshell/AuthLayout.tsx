/*
 * AuthLayout — one calm, product-focused sign-in surface.
 *
 * Desktop: two-column grid (~54 / 46). The left column carries a short
 * heading plus the campaign-map illustration (a transparent WebP asset,
 * src/assets/auth/campaign-map.webp); the auth card
 * sits right-weighted in the second column. Both are vertically centred.
 *
 * Tablet: two columns while there is room, with a smaller diagram.
 * Mobile: single column — decor hidden, form fills the width.
 *
 * The AuthShell is still available for post-login flows (2FA) where a
 * focused single card fits.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldLogo } from '../common/ShieldLogo';
import campaignMap from '../../assets/auth/campaign-map.webp';
import './authlayout.css';

type DecorVariant = 'network' | 'paused' | 'none';

interface AuthLayoutProps {
  children: React.ReactNode;
  /*
   * 'network' (default) — campaign-intelligence diagram with a short intro,
   *                       used on the primary sign-in surface.
   * 'paused'            — quieter, dashed-outline cluster with an open
   *                       central node, used on the checkout status pages.
   * 'none'              — no decor column; children get the full container
   *                       width. Used by the request-access page, which lays
   *                       out its own sticky access diagram.
   */
  decor?: DecorVariant;
}

export function AuthLayout({ children, decor = 'network' }: AuthLayoutProps) {
  return (
    <div
      className={`bantai-auth-layout bantai-auth-layout--${decor}`}
      data-theme="mineral"
    >
      <header className="bantai-auth-layout__header">
        <div className="bantai-auth-layout__container bantai-auth-layout__header-inner">
          <Link
            to="/"
            className="bantai-auth-layout__brand"
            aria-label="BantAI home"
          >
            <span className="bantai-auth-layout__brand-mark" aria-hidden>
              <ShieldLogo size={28} tone="brand" />
            </span>
            <span className="bantai-auth-layout__brand-word">BantAI</span>
          </Link>
          {/* Shares the page container with the card, so on desktop its
              right edge lines up with the card's right edge. */}
          <nav aria-label="Site">
            <Link to="/" className="bantai-auth-layout__back">
              <ChevronLeftIcon />
              Back to site
            </Link>
          </nav>
        </div>
      </header>

      <main className="bantai-auth-layout__main">
        <div className="bantai-auth-layout__container bantai-auth-layout__grid">
          {decor === 'none' ? null : decor === 'paused' ? (
            <div className="bantai-auth-layout__decor" aria-hidden>
              <DecorPaused />
            </div>
          ) : (
            <section
              className="bantai-auth-layout__intro"
              aria-labelledby="bantai-auth-intro-title"
            >
              <h2
                id="bantai-auth-intro-title"
                className="bantai-auth-layout__intro-title"
              >
                Philippine smishing intelligence
              </h2>
              <div className="bantai-auth-layout__art" aria-hidden>
                <img
                  src={campaignMap}
                  alt=""
                  width={1477}
                  height={736}
                  className="bantai-auth-art-img"
                  decoding="async"
                />
              </div>
            </section>
          )}

          <div className="bantai-auth-layout__slot">{children}</div>
        </div>
      </main>

      <footer className="bantai-auth-layout__footer">
        <div className="bantai-auth-layout__container bantai-auth-layout__footer-inner">
          <span className="bantai-auth-layout__copy">
            © {new Date().getFullYear()} BantAI thesis project
          </span>
          <nav aria-label="Auth utility" className="bantai-auth-layout__utils">
            <a href="/#about">Privacy</a>
            <a href="/#about">Security</a>
            <a href="/#how-it-works">Help</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 3.5 5.5 8l4.5 4.5" />
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
