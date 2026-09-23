/*
 * PublicShell: mineral-theme wrapper for the public landing surface.
 *
 * Nav: BantAI (logo → top) | How it works | About | Sign in | Request access.
 * Starts nearly transparent over the hero, gains cream+blur+border once the
 * visitor has scrolled past ~48px. Transition is 200ms; no parallax; the logo
 * click scrolls to the top rather than routing anywhere.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../primitives/primitives.css';
import './publicshell.css';

interface PublicShellProps {
  children: React.ReactNode;
}

interface NavLink {
  hash: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { hash: '#top', label: 'Home' },
  { hash: '#how-it-works', label: 'How it works' },
  { hash: '#about', label: 'About' },
];

export function PublicShell({ children }: PublicShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = React.useState(false);

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

  function goToAnchor(hash: string) {
    if (location.pathname !== '/') {
      void navigate(`/${hash}`);
      return;
    }
    const id = hash.slice(1);
    const el = document.getElementById(id);
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
              if (location.pathname !== '/') void navigate('/');
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="BantAI, return to top"
          >
            <span className="bantai-public__brand-mark" aria-hidden>
              B
            </span>
            <span className="bantai-public__brand-text">
              <strong>BantAI</strong>
              <small>Philippine SMS threat intelligence</small>
            </span>
          </button>

          <nav className="bantai-public__nav" aria-label="Public sections">
            {NAV_LINKS.map((link) => (
              <button
                key={link.hash}
                type="button"
                className="bantai-public__nav-link"
                onClick={() => goToAnchor(link.hash)}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="bantai-public__actions">
            <Link to="/login" className="bantai-public__action-ghost">
              Sign in
            </Link>
            <Link
              to="/request-access"
              className="bantai-public__action-primary"
            >
              Request access
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
            <button type="button" onClick={() => goToAnchor('#top')}>
              Home
            </button>
            <button type="button" onClick={() => goToAnchor('#how-it-works')}>
              How it works
            </button>
            <button type="button" onClick={() => goToAnchor('#about')}>
              About
            </button>
            <Link to="/login">Sign in</Link>
            <Link to="/request-access">Request access</Link>
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
