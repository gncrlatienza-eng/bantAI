import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccessRequestStatus, AccessRequestTier } from '@prisma/client';

import { PaymentsService } from './payments.service';

describe('PaymentsService signed-in checkout (account-first)', () => {
  const stripe = {
    checkout: {
      sessions: { create: jest.fn(), retrieve: jest.fn(), expire: jest.fn() },
    },
    webhooks: { constructEvent: jest.fn() },
  };
  const accessRequests = {
    attachCheckoutSession: jest.fn(),
    releaseExpiredCheckout: jest.fn(),
  };
  const applicants = { findOwned: jest.fn() };
  const service = new PaymentsService(
    stripe as never,
    accessRequests as never,
    applicants as never,
  );

  const accepted = {
    id: 'request-1',
    email: 'ana@uni.edu.ph',
    tier: AccessRequestTier.SHIELD,
    status: AccessRequestStatus.AGREEMENT_ACCEPTED,
    stripeCheckoutSessionId: null,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.STRIPE_CHECKOUT_MODE = 'test';
    process.env.STRIPE_PRICE_SHIELD_ANNUAL = 'price_shield_annual';
  });

  it('only checks out a request the caller owns', async () => {
    applicants.findOwned.mockRejectedValue(
      new NotFoundException('Access request not found.'),
    );
    await expect(
      service.createCheckoutForUser('user-2', 'request-1', 'ANNUAL'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(applicants.findOwned).toHaveBeenCalledWith('user-2', 'request-1');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses a request that is not awaiting payment', async () => {
    applicants.findOwned.mockResolvedValue({
      ...accepted,
      status: AccessRequestStatus.UNDER_REVIEW,
    });
    await expect(
      service.createCheckoutForUser('user-1', 'request-1', 'ANNUAL'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('creates a session bound to the request and returns to the activation page', async () => {
    applicants.findOwned.mockResolvedValue(accepted);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/1',
    });

    await expect(
      service.createCheckoutForUser('user-1', 'request-1', 'ANNUAL'),
    ).resolves.toEqual({
      status: 'open',
      url: 'https://checkout.stripe.test/1',
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'ana@uni.edu.ph',
        metadata: expect.objectContaining({ accessRequestId: 'request-1' }),
        success_url: expect.stringContaining('/activation?checkout=success'),
        cancel_url: 'http://localhost:5173/activation?checkout=cancelled',
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining(
          'bantai-checkout-request-1-ANNUAL-',
        ),
      }),
    );
    expect(accessRequests.attachCheckoutSession).toHaveBeenCalledWith(
      'request-1',
      'cs_test_1',
      'ANNUAL',
    );
  });

  it('resumes an open session instead of creating a second one', async () => {
    applicants.findOwned.mockResolvedValue({
      ...accepted,
      status: AccessRequestStatus.PAYMENT_PENDING,
      stripeCheckoutSessionId: 'cs_test_open',
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_open',
      status: 'open',
      payment_status: 'unpaid',
      url: 'https://checkout.stripe.test/open',
      metadata: { accessRequestId: 'request-1' },
    });
    await expect(
      service.createCheckoutForUser('user-1', 'request-1', 'ANNUAL'),
    ).resolves.toEqual({
      status: 'open',
      url: 'https://checkout.stripe.test/open',
    });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('reports processing (never activates) when Stripe has taken payment', async () => {
    applicants.findOwned.mockResolvedValue({
      ...accepted,
      status: AccessRequestStatus.PAYMENT_PENDING,
      stripeCheckoutSessionId: 'cs_test_paid',
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_paid',
      status: 'complete',
      payment_status: 'paid',
      metadata: { accessRequestId: 'request-1' },
    });
    await expect(
      service.createCheckoutForUser('user-1', 'request-1', 'ANNUAL'),
    ).resolves.toEqual({ status: 'processing' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('releases an expired unpaid session and starts a fresh one', async () => {
    applicants.findOwned
      .mockResolvedValueOnce({
        ...accepted,
        status: AccessRequestStatus.PAYMENT_PENDING,
        stripeCheckoutSessionId: 'cs_test_expired',
      })
      .mockResolvedValueOnce({
        ...accepted,
        updatedAt: new Date('2026-10-02T00:00:00.000Z'),
      });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_expired',
      status: 'expired',
      payment_status: 'unpaid',
      metadata: { accessRequestId: 'request-1' },
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_2',
      url: 'https://checkout.stripe.test/2',
    });

    await service.createCheckoutForUser('user-1', 'request-1', 'ANNUAL');
    expect(accessRequests.releaseExpiredCheckout).toHaveBeenCalledWith(
      'request-1',
      'cs_test_expired',
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
});
