import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientLoginForm } from '../../components/forms/ClientLoginForm';
import { TwoFactorForm } from '../../components/forms/TwoFactorForm';
import * as authService from '../../services/authService';

describe('Frontend Security & Auth: Login & MFA Flows (W9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ClientLoginForm', () => {
    it('validates email format and required password before making network requests', async () => {
      const loginSpy = vi.spyOn(authService, 'clientLogin');

      render(
        <MemoryRouter>
          <ClientLoginForm />
        </MemoryRouter>,
      );

      const submitBtn = screen.getByRole('button', { name: /Sign in/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('Enter a valid work email.')).toBeInTheDocument();
      expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
      expect(loginSpy).not.toHaveBeenCalled();
    });

    it('displays error message upon failed authentication attempt', async () => {
      vi.spyOn(authService, 'clientLogin').mockRejectedValue(
        new Error('Invalid email or password.'),
      );

      const { container } = render(
        <MemoryRouter>
          <ClientLoginForm />
        </MemoryRouter>,
      );

      const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
      const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: /Sign in/i });

      fireEvent.change(emailInput, { target: { value: 'user@company.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPassword123' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  describe('TwoFactorForm (MFA)', () => {
    it('renders 6 input slots and enforces that all 6 digits are provided before verification', async () => {
      const verifyOtpSpy = vi.spyOn(authService, 'verifyOtp');

      render(
        <MemoryRouter>
          <TwoFactorForm phone="+639171234567" />
        </MemoryRouter>,
      );

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);

      const verifyBtn = screen.getByRole('button', { name: /Verify & Continue/i });
      fireEvent.click(verifyBtn);

      expect(
        await screen.findByText(/Please enter all 6 digits of the verification code/i),
      ).toBeInTheDocument();
      expect(verifyOtpSpy).not.toHaveBeenCalled();
    });

    it('supports pasting a 6-digit OTP code into the fields', async () => {
      render(
        <MemoryRouter>
          <TwoFactorForm phone="+639171234567" />
        </MemoryRouter>,
      );

      const inputs = screen.getAllByRole('textbox');
      const firstInput = inputs[0];

      fireEvent.paste(firstInput, {
        clipboardData: {
          getData: () => '654321',
        },
      });

      expect((inputs[0] as HTMLInputElement).value).toBe('6');
      expect((inputs[1] as HTMLInputElement).value).toBe('5');
      expect((inputs[2] as HTMLInputElement).value).toBe('4');
      expect((inputs[3] as HTMLInputElement).value).toBe('3');
      expect((inputs[4] as HTMLInputElement).value).toBe('2');
      expect((inputs[5] as HTMLInputElement).value).toBe('1');

      const verifyBtn = screen.getByRole('button', { name: /Verify & Continue/i });
      expect(verifyBtn).not.toBeDisabled();
    });

    it('rejects invalid OTP submission with an error alert', async () => {
      vi.spyOn(authService, 'verifyOtp').mockRejectedValue(
        new Error('Invalid or expired verification code.'),
      );

      render(
        <MemoryRouter>
          <TwoFactorForm phone="+639171234567" />
        </MemoryRouter>,
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.paste(inputs[0], {
        clipboardData: {
          getData: () => '000000',
        },
      });

      const verifyBtn = screen.getByRole('button', { name: /Verify & Continue/i });
      fireEvent.click(verifyBtn);

      expect(
        await screen.findByText('Invalid or expired verification code.'),
      ).toBeInTheDocument();
    });
  });
});
