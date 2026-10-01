import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../services/authService';
import { AccountMenu, accountDisplayName, accountInitial } from './AccountMenu';

const admin: CurrentUser = {
  id: 'u1',
  phone: null,
  email: 'reymark@example.com',
  firstName: 'Reymark',
  lastName: 'De Castro',
  role: 'ADMIN',
  staffRole: 'SUPERADMIN',
  permissions: ['*'],
};

function renderMenu(user: CurrentUser | null = admin) {
  const onNavigate = vi.fn();
  const onSignOut = vi.fn();
  render(
    <AccountMenu
      user={user}
      settingsPath="/admin/settings"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    />,
  );
  return { onNavigate, onSignOut };
}

describe('AccountMenu', () => {
  it('shows the account initial and names the account for screen readers', () => {
    renderMenu();
    const button = screen.getByRole('button', {
      name: 'Account menu for Reymark De Castro',
    });
    expect(button).toHaveTextContent('R');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('falls back to the email initial when there is no first name', () => {
    expect(accountInitial({ ...admin, firstName: null })).toBe('R');
    expect(
      accountInitial({ ...admin, firstName: null, email: 'ops@example.com' }),
    ).toBe('O');
    expect(accountInitial(null)).toBe('?');
    expect(
      accountDisplayName({ ...admin, firstName: null, lastName: null }),
    ).toBe('reymark@example.com');
  });

  it('opens on click with identity, Settings and Sign out', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));

    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(menu).toHaveTextContent('Reymark De Castro');
    expect(menu).toHaveTextContent('reymark@example.com');
    expect(menu).toHaveTextContent('Superadmin');
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Settings',
      'Sign out',
    ]);
    // Focus moves into the menu so keyboard users land on the first item.
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();
  });

  it('navigates to Settings and signs out through the callbacks', async () => {
    const user = userEvent.setup();
    const { onNavigate, onSignOut } = renderMenu();

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/settings');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('supports arrow keys and closes on Escape, returning focus', async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = screen.getByRole('button', { name: /account menu/i });

    button.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
