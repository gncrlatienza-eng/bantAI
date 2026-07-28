import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./Button";

const LINKS = [
  { label: "How It Works", to: "/how-it-works" },
  { label: "About", to: "/about" },
  { label: "Research", to: "/research" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`.trim()}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <ShieldMark />
          <span>
            <strong>BantAI</strong>
            <small>Threat Intelligence</small>
          </span>
        </Link>

        <nav className="navbar-links">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={location.pathname === link.to ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="navbar-actions">
          <Button to="/login" variant="ghost">Log In</Button>
          <Button to="/request-access" variant="primary" className="tiny">Licensing</Button>
        </div>

        <button
          className={`navbar-toggle ${menuOpen ? "open" : ""}`.trim()}
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`navbar-mobile ${menuOpen ? "open" : ""}`.trim()}>
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className={location.pathname === link.to ? "active" : ""}>
            {link.label}
          </Link>
        ))}
        <div className="navbar-mobile-actions">
          <Button to="/login" variant="ghost" className="wide">Log In</Button>
          <Button to="/request-access" variant="primary" className="wide">Licensing</Button>
        </div>
      </div>
    </header>
  );
}

function ShieldMark() {
  return (
    <svg className="navbar-shield" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="navShieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8f89ff" />
          <stop offset="100%" stopColor="#4840c4" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 L28 7 V15 C28 22.5 22.8 28.3 16 30 C9.2 28.3 4 22.5 4 15 V7 Z"
        fill="url(#navShieldGrad)"
      />
      <path
        d="M11 15.5 L14.2 18.7 L21 11.5"
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
