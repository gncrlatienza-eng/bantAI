/*
 * PublicShell: mineral-theme wrapper for the public pages.
 *
 * Two audiences, two homes: Personal (/, the Android app, and /android) and
 * Organizations (/platform). A segmented switch beside the logo moves between
 * them, the way Philippine telco and bank sites split Personal and Business,
 * and the header's call to action follows the audience. The header carries no
 * section links; each page reads top to bottom. It gains a blurred backdrop
 * and border once the visitor has scrolled past ~48px.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ANDROID_BETA_PATH, androidCtaLabel } from '../../config/android';
import '../primitives/primitives.css';
import './publicshell.css';

interface PublicShellProps {
  children: React.ReactNode;
}

type Audience = 'personal' | 'organizations';

interface AudienceNav {
  home: string;
  label: string;
  cta: { to: string; label: string };
}

const AUDIENCES: Record<Audience, AudienceNav> = {
  personal: {
    home: '/',
    label: 'Personal',
    cta: { to: ANDROID_BETA_PATH, label: androidCtaLabel() },
  },
  organizations: {
    home: '/platform',
    label: 'Organizations',
    cta: { to: '/request-access', label: 'Request access' },
  },
};

function audienceFor(pathname: string): Audience {
  return pathname.startsWith('/platform') ? 'organizations' : 'personal';
}

export function PublicShell({ children }: PublicShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = React.useState(false);
  const audience = audienceFor(location.pathname);
  const nav = AUDIENCES[audience];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // If we land with a hash in the URL, jump to it after mount so section
  // anchors from /how-it-works → /#how-it-works redirects land correctly.
  React.useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }, [location.hash]);

  /** Scroll to a section of `home`, routing there first if needed. */
  function goToAnchor(home: string, hash: string) {
    if (location.pathname !== home) {
      void navigate(`${home}${hash}`);
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bantai-public" data-theme="mineral">
      <header
        className={`bantai-public__header${scrolled ? ' is-scrolled' : ''}`}
      >
        <div className="bantai-public__header-inner">
          <button
            type="button"
            className="bantai-public__brand"
            onClick={() => {
              if (location.pathname !== nav.home) void navigate(nav.home);
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="BantAI, return to top"
          >
            <span className="bantai-public__brand-mark" aria-hidden>
              B
            </span>
            <span className="bantai-public__brand-text">
              <strong>BantAI</strong>
            </span>
          </button>

          <nav
            className="bantai-public__switch"
            aria-label="Choose who BantAI is for"
          >
            {(Object.keys(AUDIENCES) as Audience[]).map((key) => (
              <Link
                key={key}
                to={AUDIENCES[key].home}
                className="bantai-public__switch-option"
                aria-current={key === audience ? 'page' : undefined}
              >
                {AUDIENCES[key].label}
              </Link>
            ))}
          </nav>

          <div className="bantai-public__actions">
            <Link to="/login" className="bantai-public__action-ghost">
              Sign in
            </Link>
            <Link to={nav.cta.to} className="bantai-public__action-primary">
              {nav.cta.label}
            </Link>
          </div>
        </div>
      </header>

      <main className="bantai-public__main">{children}</main>

      <footer className="bantai-public__footer">
        <div className="bantai-public__footer-inner">
          <div>
            <strong>BantAI</strong>
            <p className="bantai-public__footer-tag">
              An undergraduate thesis project on SMS smishing detection for
              Filipino mobile users.
            </p>
          </div>
          <nav
            className="bantai-public__footer-nav"
            aria-label="Footer navigation"
          >
            <button type="button" onClick={() => goToAnchor('/', '#top')}>
              Home
            </button>
            <button
              type="button"
              onClick={() => goToAnchor('/', '#how-it-works')}
            >
              How it works
            </button>
            <Link to={ANDROID_BETA_PATH}>Android beta</Link>
            <Link to="/platform">For organizations</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/request-access">Request access</Link>
            <Link to="/legal?tab=terms">Terms</Link>
            <Link to="/legal?tab=privacy">Privacy</Link>
            <Link to="/legal?tab=license">License</Link>
            <Link to="/legal?tab=redress">DPO &amp; Redress</Link>
          </nav>
        </div>
        <p className="bantai-public__footer-copy">
          &copy; {new Date().getFullYear()} BantAI thesis team.
        </p>
      </footer>
    </div>
  );
}

export default PublicShell;
