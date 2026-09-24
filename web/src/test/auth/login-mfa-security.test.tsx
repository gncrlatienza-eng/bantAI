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
    it('validates email format and required password before making network requests', async () => {
      const loginSpy = vi.spyOn(authService, 'clientLogin');

      render(
        <MemoryRouter>
          <ClientLoginForm />
        </MemoryRouter>,
      );

      const submitBtn = screen.getByRole('button', { name: /Sign in/i });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('Enter a valid work email.'),
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Enter your password.'),
      ).toBeInTheDocument();
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

      const emailInput = container.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;
      const passwordInput = container.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: /Sign in/i });

      fireEvent.change(emailInput, { target: { value: 'user@company.com' } });
      fireEvent.change(passwordInput, {
        target: { value: 'WrongPassword123' },
      });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('Invalid email or password.'),
      ).toBeInTheDocument();
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

    it('password success alone cannot access privileged ADMIN endpoints and persists no token before MFA', async () => {
      const requestOtpSpy = vi.spyOn(authService, 'requestOtp');
      const staffMfaSpy = vi
        .spyOn(authService.staffMfaConfig, 'requestStaffMfa')
        .mockResolvedValue({ message: 'OTP sent to Gmail' });

      // Mock fetchApi for /auth/login returning MFA required (no access_token)
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        const endpoint =
          typeof url === 'string'
            ? url
            : url instanceof Request
              ? url.url
              : String(url);
        if (endpoint.includes('/auth/login')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                message: 'MFA verification required.',
                requiresMfa: true,
                email: 'staff@internal.bantai.dev',
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Authentication required.' }),
        } as Response);
      });

      const res = await authService.adminAuthenticateStaff(
        'staff@internal.bantai.dev',
        'StaffSecretPassword123',
      );

      expect(res.requiresMfa).toBe(true);
      // No privileged bearer token must be persisted before MFA completes
      expect(localStorage.getItem('bantai_token')).toBeNull();
      // SMS OTP must NOT be used for staff MFA
      expect(requestOtpSpy).not.toHaveBeenCalled();
      expect(staffMfaSpy).toHaveBeenCalledWith('staff@internal.bantai.dev');
    });

    it('customer accounts cannot complete Admin login', async () => {
      // Mock /auth/login returning a customer token (not requiring MFA)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            message: 'Authentication successful.',
            access_token: 'customer_jwt_token',
          }),
      } as Response);

      await expect(
        authService.adminAuthenticateStaff(
          'customer@example.com',
          'CustomerPassword123',
        ),
      ).rejects.toThrow(
        'Access denied: Customer accounts cannot sign in to the Internal Admin portal. Please use the Client Portal.',
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
        if (endpoint.includes('/auth/login')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                message: 'MFA verification required.',
                requiresMfa: true,
                email: 'staff@internal.bantai.dev',
              }),
          } as Response);
        }
        if (endpoint.includes('/auth/request-otp')) {
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
        authService.adminAuthenticateStaff(
          'staff@internal.bantai.dev',
          'StaffSecretPassword123',
        ),
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
      const passwordInput = container.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: /Continue to Staff MFA/i,
      });

      fireEvent.change(emailInput, {
        target: { value: 'staff@internal.bantai.dev' },
      });
      fireEvent.change(passwordInput, {
        target: { value: 'StaffSecretPassword123' },
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

    it('successful OTP verification produces the authenticated staff session/token', async () => {
      vi.spyOn(authService, 'adminAuthenticateStaff').mockResolvedValue({
        email: 'staff@internal.bantai.dev',
        requiresMfa: true,
      });
      vi.spyOn(authService, 'adminVerifyMfa').mockImplementation(() => {
        localStorage.setItem('bantai_token', 'verified_staff_jwt');
        return Promise.resolve({
          token: 'verified_staff_jwt',
          user: {
            id: 'admin-1',
            email: 'staff@internal.bantai.dev',
            phone: '+639170000001',
            role: 'ADMIN',
            staffRole: 'SUPERADMIN',
          },
        });
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
      fireEvent.change(
        container.querySelector('input[name="password"]') as HTMLInputElement,
        { target: { value: 'StaffSecretPassword123' } },
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Continue to Staff MFA/i }),
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
        expect(localStorage.getItem('bantai_token')).toBe('verified_staff_jwt');
      });
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
          if (endpoint.includes('/auth/login')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  message: 'MFA verification required.',
                  requiresMfa: true,
                  email: 'admin.ops@gmail.com',
                }),
            } as Response);
          }
          if (endpoint.includes('/auth/request-otp')) {
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

      await authService.adminAuthenticateStaff(
        'admin.ops@gmail.com',
        'StaffPass123!',
      );

      // Stated requirement is Gmail/email, NOT SMS
      expect(requestOtpSpy).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/request-otp'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'admin.ops@gmail.com' }),
        }),
      );
    });
  });
});
