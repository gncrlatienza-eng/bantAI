import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountStateProvider } from '../../context/AccountStateContext';
import { LoginForm } from '../../components/forms/LoginForm';
import * as auth from '../../services/authService';
import * as account from '../../services/accountService';

function mount() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AccountStateProvider>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route
            path="/admin/overview"
            element={<div>Authenticated admin</div>}
          />
        </Routes>
      </AccountStateProvider>
    </MemoryRouter>,
  );
}
async function requestCode() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'qa@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'qa-long-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByLabelText('Verification code');
}

describe('Unified password and emailed-code sign in', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it('validates credentials before requesting email', () => {
    const request = vi.spyOn(auth, 'requestPortalEmailOtp');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('keeps sign-in unauthenticated when delivery fails', async () => {
    vi.spyOn(auth, 'requestPortalEmailOtp').mockRejectedValue(
      new Error('Email delivery unavailable'),
    );
    const state = vi.spyOn(account, 'getAccountState');
    mount();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'qa@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'qa-long-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email delivery unavailable',
    );
    expect(state).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText('Verification code'),
    ).not.toBeInTheDocument();
  });
  it('requires all six OTP digits without creating a session', async () => {
    const request = vi
      .spyOn(auth, 'requestPortalEmailOtp')
      .mockResolvedValue({ message: 'Code sent' });
    const verify = vi.spyOn(auth, 'verifyPortalEmailOtp');
    mount();
    await requestCode();
    expect(request).toHaveBeenCalledWith('qa@example.com', 'qa-long-password');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(
      screen.getByText('Enter the 6-digit code from your email.'),
    ).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
    expect(localStorage.getItem('bantai_token')).toBeNull();
  });
  it('does not resolve account access after failed verification', async () => {
    vi.spyOn(auth, 'requestPortalEmailOtp').mockResolvedValue({
      message: 'Code sent',
    });
    vi.spyOn(auth, 'verifyPortalEmailOtp').mockRejectedValue(
      new Error('Invalid or expired OTP'),
    );
    const state = vi.spyOn(account, 'getAccountState');
    mount();
    await requestCode();
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'incorrect or has expired',
    );
    expect(state).not.toHaveBeenCalled();
  });
  it('uses the server lifecycle destination after successful verification', async () => {
    vi.spyOn(auth, 'requestPortalEmailOtp').mockResolvedValue({
      message: 'Code sent',
    });
    vi.spyOn(auth, 'verifyPortalEmailOtp').mockResolvedValue({
      message: 'Verified',
      access_token: '',
    });
    vi.spyOn(account, 'getAccountState').mockResolvedValue({
      state: 'ADMIN',
      routeGroups: ['admin'],
      destination: '/admin/overview',
    } as account.AccountState);
    mount();
    await requestCode();
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Authenticated admin')).toBeInTheDocument();
    expect(localStorage.getItem('bantai_token')).toBeNull();
  });
});
