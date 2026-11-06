import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAccountState } from '../../context/AccountStateContext';
import type { RouteGroup } from '../../services/accountService';
import { logout } from '../../services/authService';
import { ShieldLogo } from '../common/ShieldLogo';
import './authlayout.css';
import './accountlayout.css';

/*
 * AccountLayout — the signed-in lifecycle surface (setup, application,
 * activation, expired, status, account).
 *
 * The person is already authenticated, so there is deliberately no way to
 * "leave" to the public site or back to sign-in: the brand is not a link, and
 * there is no public nav, pricing, or footer navigation. The only exits are
 * the pages the server says this state may reach, and Log out (which ends the
 * session). Browser Back is left alone; the route guard re-resolves state.
 */

const LINKS: Array<{ group: RouteGroup; to: string; label: string }> = [
  { group: 'workspace', to: '/shield/overview', label: 'Shield' },
  { group: 'expired', to: '/access/expired', label: 'Access' },
  { group: 'activation', to: '/activation', label: 'Activation' },
  { group: 'application', to: '/application', label: 'Request status' },
  { group: 'account', to: '/account', label: 'Account' },
];

interface AccountLayoutProps {
  /** Short context shown beside the brand, e.g. "Account setup". */
  context: string;
  /** Hide in-flow page links (mandatory setup shows none). */
  focused?: boolean;
  children: React.ReactNode;
}

export function AccountLayout({
  context,
  focused = false,
  children,
}: AccountLayoutProps) {
  const navigate = useNavigate();
  const { state, clear } = useAccountState();
  const groups = state?.routeGroups ?? [];
  const links = focused
    ? []
    : LINKS.filter((link) => groups.includes(link.group));

  function signOut() {
    logout();
    clear();
    void navigate('/login', { replace: true });
  }

  return (
    <div
      className="bantai-auth-layout bantai-account-layout"
      data-theme="mineral"
    >
      <header className="bantai-auth-layout__header bantai-account-layout__header">
        <div className="bantai-auth-layout__container bantai-account-layout__bar">
          <span className="bantai-auth-layout__brand">
            <span className="bantai-auth-layout__brand-mark" aria-hidden>
              <ShieldLogo size={28} tone="brand" />
            </span>
            <span className="bantai-auth-layout__brand-word">BantAI</span>
            <span className="bantai-account-layout__context">{context}</span>
          </span>
          <div className="bantai-account-layout__session">
            {state?.account?.email && (
              <span
                className="bantai-account-layout__email"
                title={state.account.email}
              >
                {state.account.email}
              </span>
            )}
            <button
              type="button"
              className="bantai-account-layout__logout"
              onClick={signOut}
            >
              Log out
            </button>
          </div>
        </div>
        {links.length > 1 && (
          <nav
            aria-label="Account"
            className="bantai-auth-layout__container bantai-account-layout__nav"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `bantai-account-layout__navlink${isActive ? ' is-active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="bantai-account-layout__main">
        <div className="bantai-auth-layout__container bantai-account-layout__column">
          {children}
        </div>
      </main>

      <footer className="bantai-auth-layout__footer">
        <div className="bantai-auth-layout__container bantai-auth-layout__footer-inner">
          <span className="bantai-auth-layout__copy">
            © {new Date().getFullYear()} BantAI thesis project
          </span>
        </div>
      </footer>
    </div>
  );
}

export default AccountLayout;
