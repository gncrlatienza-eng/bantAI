import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountStateProvider } from '../../context/AccountStateContext';
import { LifecycleRoute } from '../../routes/LifecycleRoute';
import { ApiError } from '../../api/apiClient';
import * as account from '../../services/accountService';

function mount(group: 'admin' | 'workspace') {
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <AccountStateProvider>
        <Routes>
          <Route
            path="/protected"
            element={
              <LifecycleRoute group={group}>
                <div>Protected content</div>
              </LifecycleRoute>
            }
          />
          <Route path="/login" element={<div>Sign in</div>} />
          <Route path="/application" element={<div>Application status</div>} />
        </Routes>
      </AccountStateProvider>
    </MemoryRouter>,
  );
}

describe('Server account lifecycle routing', () => {
  beforeEach(() => vi.restoreAllMocks());
  it.each(['admin', 'workspace'] as const)(
    'refuses anonymous %s content',
    async (group) => {
      vi.spyOn(account, 'getAccountState').mockRejectedValue(
        new ApiError('Unauthorized', 401),
      );
      mount(group);
      expect(await screen.findByText('Sign in')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    },
  );
  it('routes a pending applicant to the server destination instead of admin', async () => {
    vi.spyOn(account, 'getAccountState').mockResolvedValue({
      routeGroups: ['application'],
      destination: '/application',
      state: 'APPLICATION_PENDING',
    } as account.AccountState);
    mount('admin');
    expect(await screen.findByText('Application status')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('renders an authorized server route group', async () => {
    vi.spyOn(account, 'getAccountState').mockResolvedValue({
      routeGroups: ['admin'],
      destination: '/protected',
      state: 'ADMIN',
    } as account.AccountState);
    mount('admin');
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });
  it('keeps content hidden on network failure', async () => {
    vi.spyOn(account, 'getAccountState').mockRejectedValue(
      new Error('Offline'),
    );
    mount('admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'reach BantAI to load your account',
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
