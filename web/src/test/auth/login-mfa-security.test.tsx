import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientLoginForm } from '../../components/forms/ClientLoginForm';
import { TwoFactorForm } from '../../components/forms/TwoFactorForm';
import { AdminLoginForm } from '../../components/forms/AdminLoginForm';
import * as authService from '../../services/authService';

describe('Frontend Security & Auth: Login & MFA Flows (W9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ClientLoginForm', () => {
    it('validates email format before requesting a code', async () => {
      const requestSpy = vi.spyOn(authService, 'requestClientEmailOtp');

      render(
        <MemoryRouter>
          <ClientLoginForm />
        </MemoryRouter>,
      );

      const submitBtn = screen.getByRole('button', {
        name: /Send verification code/i,
      });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('Enter a valid work email.'),
      ).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
    });

    it('displays delivery failure without creating a session', async () => {
      vi.spyOn(authService, 'requestClientEmailOtp').mockRejectedValue(
        new Error('OTP delivery is temporarily unavailable.'),
      );

      const { container } = render(
        <MemoryRouter>
          <ClientLoginForm />
        </MemoryRouter>,
      );

      const emailInput = container.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: /Send verification code/i,
      });

      fireEvent.change(emailInput, { target: { value: 'user@company.com' } });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('OTP delivery is temporarily unavailable.'),
      ).toBeInTheDocument();
      expect(localStorage.getItem('bantai_token')).toBeNull();
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

      const verifyBtn = screen.getByRole('button', {
        name: /Verify & Continue/i,
      });
      fireEvent.click(verifyBtn);

      expect(
        await screen.findByText(
          /Please enter all 6 digits of the verification code/i,
        ),
      ).toBeInTheDocument();
      expect(verifyOtpSpy).not.toHaveBeenCalled();
    });

    it('supports pasting a 6-digit OTP code into the fields', () => {
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

      const verifyBtn = screen.getByRole('button', {
        name: /Verify & Continue/i,
      });
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

      const verifyBtn = screen.getByRole('button', {
        name: /Verify & Continue/i,
      });
      fireEvent.click(verifyBtn);

      expect(
        await screen.findByText('Invalid or expired verification code.'),
      ).toBeInTheDocument();
    });
  });

  describe('Staff MFA Security & Enforcement (W2 & W9)', () => {
    beforeEach(() => {
      authService.logout();
      vi.restoreAllMocks();
    });

    it('requesting an admin email code persists no bearer token before verification', async () => {
      const requestOtpSpy = vi.spyOn(authService, 'requestOtp');
      const staffMfaSpy = vi
        .spyOn(authService.staffMfaConfig, 'requestStaffMfa')
        .mockResolvedValue({ message: 'OTP sent to Gmail' });

      const res = await authService.adminAuthenticateStaff(
        'staff@internal.bantai.dev',
      );

      expect(res.requiresMfa).toBe(true);
      // No privileged bearer token must be persisted before MFA completes
      expect(localStorage.getItem('bantai_token')).toBeNull();
      // SMS OTP must NOT be used for staff MFA
      expect(requestOtpSpy).not.toHaveBeenCalled();
      expect(staffMfaSpy).toHaveBeenCalledWith('staff@internal.bantai.dev');
    });

    it('admin request response does not reveal whether an account is eligible', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 202,
        json: () =>
          Promise.resolve({
            message:
              'If the account is eligible, a verification code has been sent.',
          }),
      } as Response);

      await expect(
        authService.adminAuthenticateStaff('customer@example.com'),
      ).resolves.toEqual(
        expect.objectContaining({ email: 'customer@example.com' }),
      );

      expect(localStorage.getItem('bantai_token')).toBeNull();
    });

    it('OTP delivery failure fails closed and does not proceed to authenticated state', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        const endpoint =
          typeof url === 'string'
            ? url
            : url instanceof Request
              ? url.url
              : url.toString();
        if (endpoint.includes('/auth/admin/request-email-otp')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () =>
              Promise.resolve({
                message: 'OTP delivery is temporarily unavailable.',
              }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await expect(
        authService.adminAuthenticateStaff('staff@internal.bantai.dev'),
      ).rejects.toThrow(/OTP delivery is temporarily unavailable/);

      // Must fail closed: no session token stored
      expect(localStorage.getItem('bantai_token')).toBeNull();
    });

    it('failed OTP verification does not authenticate the staff user', async () => {
      vi.spyOn(authService, 'adminAuthenticateStaff').mockResolvedValue({
        email: 'staff@internal.bantai.dev',
        requiresMfa: true,
      });
      vi.spyOn(authService, 'adminVerifyMfa').mockRejectedValue(
        new Error('Invalid MFA verification code.'),
      );

      const { container } = render(
        <MemoryRouter>
          <AdminLoginForm />
        </MemoryRouter>,
      );

      // Fill in credentials and submit to advance to MFA
      const emailInput = container.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: /Send staff verification code/i,
      });

      fireEvent.change(emailInput, {
        target: { value: 'staff@internal.bantai.dev' },
      });
      fireEvent.click(submitBtn);

      // Expect MFA challenge inputs to render
      expect(
        await screen.findByText(/Staff MFA challenge/i),
      ).toBeInTheDocument();
      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);

      // Enter invalid OTP
      fireEvent.paste(inputs[0], {
        clipboardData: { getData: () => '999999' },
      });

      const verifyBtn = screen.getByRole('button', {
        name: /Verify & Enter Admin Portal/i,
      });
      fireEvent.click(verifyBtn);

      expect(
        await screen.findByText('Invalid MFA verification code.'),
      ).toBeInTheDocument();
      expect(localStorage.getItem('bantai_token')).toBeNull();
    });

    it('successful OTP verification uses the cookie session without localStorage', async () => {
      vi.spyOn(authService, 'adminAuthenticateStaff').mockResolvedValue({
        email: 'staff@internal.bantai.dev',
        requiresMfa: true,
      });
      const verifySpy = vi
        .spyOn(authService, 'adminVerifyMfa')
        .mockResolvedValue({
          user: {
            id: 'admin-1',
            email: 'staff@internal.bantai.dev',
            phone: '+639170000001',
            role: 'ADMIN',
            staffRole: 'SUPERADMIN',
          },
        });

      const { container } = render(
        <MemoryRouter>
          <AdminLoginForm />
        </MemoryRouter>,
      );

      // Fill credentials
      fireEvent.change(
        container.querySelector('input[name="email"]') as HTMLInputElement,
        { target: { value: 'staff@internal.bantai.dev' } },
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Send staff verification code/i }),
      );

      // Wait for MFA challenge screen
      expect(
        await screen.findByText(/Staff MFA challenge/i),
      ).toBeInTheDocument();

      // Enter valid OTP
      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);
      fireEvent.paste(inputs[0], {
        clipboardData: { getData: () => '123456' },
      });

      const verifyBtn = screen.getByRole('button', {
        name: /Verify & Enter Admin Portal/i,
      });
      fireEvent.click(verifyBtn);

      await vi.waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith(
          'staff@internal.bantai.dev',
          '123456',
        );
      });
      expect(localStorage.getItem('bantai_token')).toBeNull();
    });

    it('staff MFA uses the required Gmail/email OTP flow rather than SMS', async () => {
      const requestOtpSpy = vi.spyOn(authService, 'requestOtp');
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url, init) => {
          const endpoint =
            typeof url === 'string'
              ? url
              : url instanceof Request
                ? url.url
                : url.toString();
          if (endpoint.includes('/auth/admin/request-email-otp')) {
            expect(init?.body).toBe(
              JSON.stringify({ email: 'admin.ops@gmail.com' }),
            );
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  message: 'OTP generated successfully.',
                }),
            } as Response);
          }
          return Promise.reject(new Error('Unknown endpoint'));
        });

      await authService.adminAuthenticateStaff('admin.ops@gmail.com');

      // Stated requirement is Gmail/email, NOT SMS
      expect(requestOtpSpy).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/admin/request-email-otp'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'admin.ops@gmail.com' }),
        }),
      );
    });
  });
});
