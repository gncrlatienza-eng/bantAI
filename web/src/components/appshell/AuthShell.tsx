/*
 * AuthShell: mineral-theme wrapper for Login, AdminLogin, Register, TwoFactor.
 *
 * Centers a single card on the mineral-fog canvas. No dark-theme leftovers,
 * no glassy/blur back-to-home pill. The mineral shell is warm and light;
 * treat auth as a moment of attention, not a "spy" surface.
 *
 * Consumers pass their title/subtitle and slot in the form. Optional
 * back link renders top-left in the neutral palette.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import '../primitives/primitives.css';
import './authshell.css';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  warningStrip?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  warningStrip,
  backHref,
  backLabel = 'Return to home',
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="bantai-auth-shell" data-theme="mineral">
      {backHref && (
        <Link to={backHref} className="bantai-auth-shell__back">
          &larr; {backLabel}
        </Link>
      )}
      <main className="bantai-auth-shell__main">
        <div className="bantai-auth-card">
          <div className="bantai-auth-card__brand" aria-hidden>
            B
          </div>
          <h1 className="bantai-auth-card__title">{title}</h1>
          {subtitle && (
            <p className="bantai-auth-card__subtitle">{subtitle}</p>
          )}
          {warningStrip && (
            <div className="bantai-auth-card__warning" role="note">
              {warningStrip}
            </div>
          )}
          <div className="bantai-auth-card__body">{children}</div>
          {footer && (
            <div className="bantai-auth-card__footer">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AuthShell;
