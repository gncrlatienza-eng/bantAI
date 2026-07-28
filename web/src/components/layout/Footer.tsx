import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { ShieldLogo } from '../common/ShieldLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="public-footer">
      <div className="footer-inner">
        <div>
          <div className="brand-lockup" style={{ marginBottom: 12 }}>
            <ShieldLogo size={28} />
            <div className="brand-text">
              <strong>BantAI</strong>
              <small>Philippine SMS Threat Intelligence Platform</small>
            </div>
          </div>
          <p style={{ maxWidth: 400, color: 'var(--text-muted)' }}>
            Empowering Philippine telecommunications providers, cybersecurity agencies, and law enforcement with real-time smishing campaign intelligence.
          </p>
        </div>

        <div className="footer-links">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Platform</strong>
            <Link to={ROUTES.HOW_IT_WORKS}>How It Works</Link>
            <Link to={ROUTES.RESEARCH}>Research & Methodology</Link>
            <Link to={ROUTES.LOGIN}>Client Intelligence Portal</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Organization</strong>
            <Link to={ROUTES.ABOUT}>About BantAI</Link>
            <Link to={ROUTES.LOGIN}>Client Portal</Link>
            <Link to={ROUTES.ADMIN_LOGIN}>Admin Access</Link>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: '24px auto 0 auto', paddingTop: 20, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        <span>© {new Date().getFullYear()} BantAI Research Group. All rights reserved.</span>
        <span>Philippine Smishing Threat Intelligence Thesis Project</span>
      </div>
    </footer>
  );
};
