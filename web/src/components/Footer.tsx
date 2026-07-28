import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <strong>BantAI</strong>
          <small>Philippine SMS Threat Intelligence Platform</small>
        </div>
        <nav className="site-footer-nav">
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/about">About</Link>
          <Link to="/research">Research</Link>
          <Link to="/request-access">Licensing</Link>
        </nav>
        <small className="site-footer-copy">© 2026 BantAI Research Group — DLSU Lipa CITE</small>
      </div>
    </footer>
  );
}
