import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CheckoutConfirmationPage } from '../../pages/RequestAccess/CheckoutConfirmationPage';
import {
  CheckoutPendingPage,
  CheckoutCancelledPage,
} from '../../pages/RequestAccess/CheckoutPendingPage';
import * as authService from '../../services/authService';

describe('Frontend Security: Checkout & Activation Security (W8/W9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CheckoutConfirmationPage Gating', () => {
    it('disables payment progression until customer explicitly agrees to commerce disclosures and terms', async () => {
      vi.spyOn(authService, 'getAccessRequestByToken').mockResolvedValue({
        id: 'req_123',
        tier: 'ORGANIZATION' as any,
        status: 'APPROVED',
        fullName: 'Jane Doe',
        email: 'jane@enterprise.ph',
        organization: 'Enterprise Corp',
        billingPeriod: null,
        approvedAt: '2026-09-01T00:00:00Z',
        activatedAt: null,
      });

      render(
        <MemoryRouter
          initialEntries={['/request-access/checkout?token=valid_token']}
        >
          <Routes>
            <Route
              path="/request-access/checkout"
              element={<CheckoutConfirmationPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      // Wait for access request data to load
      await waitFor(() => {
        expect(
          screen.getByText(/Continue to secure payment for your/i),
        ).toBeInTheDocument();
      });

      const continueBtn = screen.getByRole('button', {
        name: /Continue to secure payment/i,
      });
      expect(continueBtn).toBeDisabled();

      // Find the agreement checkbox in CommerceDisclosuresCard
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      // Check the terms agreement
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(continueBtn).not.toBeDisabled();
    });

    it('submits checkout request with selected billing period when agreed', async () => {
      vi.spyOn(authService, 'getAccessRequestByToken').mockResolvedValue({
        id: 'req_123',
        tier: 'RESEARCH' as any,
        status: 'APPROVED',
        fullName: 'Dr. Cruz',
        email: 'cruz@university.edu.ph',
        organization: 'University Research Lab',
        billingPeriod: null,
        approvedAt: '2026-09-01T00:00:00Z',
        activatedAt: null,
      });

      const mockCreateSession = vi
        .spyOn(authService, 'createCheckoutSession')
        .mockResolvedValue({
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        });

      render(
        <MemoryRouter
          initialEntries={[
            '/request-access/checkout?token=valid_research_token',
          ]}
        >
          <Routes>
            <Route
              path="/request-access/checkout"
              element={<CheckoutConfirmationPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Continue to secure payment/i }),
        ).toBeInTheDocument();
      });

      // Switch to Monthly radio option
      const monthlyRadio = screen.getByLabelText(/Monthly/i);
      fireEvent.click(monthlyRadio);

      // Agree to terms
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Click Continue
      const continueBtn = screen.getByRole('button', {
        name: /Continue to secure payment/i,
      });
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith(
          'valid_research_token',
          'MONTHLY',
        );
        expect(window.location.assign).toHaveBeenCalledWith(
          'https://checkout.stripe.com/pay/cs_test_123',
        );
      });
    });
  });

  describe('CheckoutPendingPage Non-Authoritative Behavior', () => {
    it('does not trigger any API calls or activate access on load, reload, or parameter injection', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(
        <MemoryRouter
          initialEntries={[
            '/request-access/pending?session_id=fake_tampered_session_xyz',
          ]}
        >
          <Routes>
            <Route
              path="/request-access/pending"
              element={<CheckoutPendingPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        screen.getByText(/Thanks — Stripe accepted your payment/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /the webhook is the only signal we trust to flip a license to/i,
        ),
      ).toBeInTheDocument();

      // Critical Security Assertion: Loading the pending/success URL makes ZERO network calls
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cancelled checkout page also performs no state mutation', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(
        <MemoryRouter initialEntries={['/request-access/cancelled']}>
          <Routes>
            <Route
              path="/request-access/cancelled"
              element={<CheckoutCancelledPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        screen.getByText(/You cancelled the secure payment/i),
      ).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
