import React from 'react';
import type { CurrentUser } from '../../services/authService';

/*
 * Signed-in account affordance at the right of the top bar: the account's
 * initial, opening a menu with who is signed in, Settings and Sign out.
 * Replaces the bare "Sign out" button every admin page used to pass in.
 *
 * Follows the WAI-ARIA menu button pattern: Enter/Space/ArrowDown open the
 * menu on its first item, ArrowUp/ArrowDown/Home/End move between items,
 * Escape closes and returns focus to the button, and a click outside closes.
 */

interface AccountMenuProps {
  user: CurrentUser | null;
  settingsPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

export function accountDisplayName(user: CurrentUser | null): string {
  if (!user) return 'Signed-in account';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Signed-in account';
}

export function accountInitial(user: CurrentUser | null): string {
  const source = user?.firstName?.trim() || user?.email?.trim() || '';
  return source ? source[0].toUpperCase() : '?';
}

function staffRoleLabel(staffRole: string | null | undefined): string | null {
  if (!staffRole) return null;
  return staffRole.charAt(0) + staffRole.slice(1).toLowerCase();
}

export function AccountMenu({
  user,
  settingsPath,
  onNavigate,
  onSignOut,
}: AccountMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const name = accountDisplayName(user);
  const email = user?.email && user.email !== name ? user.email : null;
  const role = staffRoleLabel(user?.staffRole);

  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    );

  const close = React.useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  function onButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (index + 1) % list.length;
    else if (e.key === 'ArrowUp')
      next = (index - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    } else if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (next != null) {
      e.preventDefault();
      list[next]?.focus();
    }
  }

  return (
    <div className="bantai-account" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="bantai-account__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${name}`}
        title={name}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
      >
        <span className="bantai-account__avatar" aria-hidden>
          {accountInitial(user)}
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="bantai-account__menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
        >
          <div className="bantai-account__identity">
            <span
              className="bantai-account__avatar bantai-account__avatar--large"
              aria-hidden
            >
              {accountInitial(user)}
            </span>
            <span className="bantai-account__who">
              <span className="bantai-account__name">{name}</span>
              {email && <span className="bantai-account__detail">{email}</span>}
              {role && <span className="bantai-account__detail">{role}</span>}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="bantai-account__item"
            onClick={() => {
              close(false);
              onNavigate(settingsPath);
            }}
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="bantai-account__item"
            onClick={() => {
              close(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
