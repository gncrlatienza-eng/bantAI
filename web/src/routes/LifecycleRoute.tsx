import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAccountState } from '../context/AccountStateContext';
import type { RouteGroup } from '../services/accountService';
import '../pages/RequestAccess/request-access.css';

/*
 * Central route guard for every signed-in area. The server decides the
 * lifecycle state and which route groups it may reach
 * (GET /api/account/state); anything else redirects to the one allowed
 * destination. Deny by default: an unknown state or group never renders.
 *
 * This is UX, not security — every API behind these pages re-checks
 * authentication, license, and capability on its own.
 */

function Pending() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-theme="mineral"
      style={{
        minHeight: '100svh',
        background: 'var(--surface-canvas)',
        colorScheme: 'light',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--text-secondary)',
        font: '500 0.9rem var(--font-sans)',
      }}
    >
      Loading your account…
    </div>
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-theme="mineral"
      style={{
        minHeight: '100svh',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        colorScheme: 'light',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        gap: 12,
        font: '500 0.95rem var(--font-sans)',
      }}
    >
      <div>
        <p>We couldn’t reach BantAI to load your account.</p>
        <button
          type="button"
          className="ra-button ra-button--ghost"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function LifecycleRoute({
  group,
  children,
}: {
  group: RouteGroup;
  children: React.ReactNode;
}) {
  const { status, state, ensure, refresh } = useAccountState();
  const location = useLocation();
  useEffect(() => {
    ensure();
  }, [ensure]);

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!state) {
    if (status === 'error')
      return <Unavailable onRetry={() => void refresh()} />;
    return <Pending />;
  }
  if (!state.routeGroups.includes(group)) {
    return <Navigate to={state.destination} replace />;
  }
  return <>{children}</>;
}

/*
 * Public entry points (/login, /signup, /request-access). A signed-in user
 * never sees the anonymous version: they go to their current state instead.
 */
export function SignedOutOnly({ children }: { children: React.ReactNode }) {
  const { status, state, ensure } = useAccountState();
  useEffect(() => {
    ensure();
  }, [ensure]);

  if (status === 'ready' && state) {
    return <Navigate to={state.destination} replace />;
  }
  if (status === 'idle' || (status === 'loading' && !state)) return <Pending />;
  return <>{children}</>;
}

/*
 * Public pages a signed-in person may still browse (e.g. the landing page).
 * Only an unfinished account is pulled back: setup is mandatory.
 */
export function SetupGate({ children }: { children: React.ReactNode }) {
  const { state, ensure } = useAccountState();
  useEffect(() => {
    ensure();
  }, [ensure]);
  if (state?.state === 'SETUP_REQUIRED') {
    return <Navigate to={state.destination} replace />;
  }
  return <>{children}</>;
}
