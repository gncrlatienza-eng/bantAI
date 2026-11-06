import {
  AccessRequestStatus,
  AccessRequestTier,
  BillingPeriod,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService checkout idempotency', () => {
  const stripe = {
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        expire: jest.fn(),
      },
    },
    webhooks: { constructEvent: jest.fn() },
  };
  const accessRequests = {
    consumeApprovalToken: jest.fn(),
    releaseApprovalToken: jest.fn(),
    attachCheckoutSession: jest.fn(),
    activateFromWebhook: jest.fn(),
    getPaymentLifecycleRecord: jest.fn(),
    cancelUnpaid: jest.fn(),
    deleteTerminal: jest.fn(),
  };
  const service = new PaymentsService(stripe as never, accessRequests as never);

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.STRIPE_CHECKOUT_MODE = 'test';
    delete process.env.STRIPE_TEST_PILOT;
    process.env.STRIPE_PRICE_SHIELD_ANNUAL = 'price_shield_annual';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    accessRequests.consumeApprovalToken.mockResolvedValue({
      tokenId: 'token-1',
      record: {
        id: 'request-1',
        email: 'client@example.com',
        tier: AccessRequestTier.SHIELD,
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
      },
    });
  });

  it('uses a stable Stripe idempotency key and attaches one session', async () => {
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/session',
    });

    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).resolves.toEqual({ url: 'https://checkout.stripe.test/session' });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: 'bantai-checkout-request-1-ANNUAL' },
    );
    expect(accessRequests.attachCheckoutSession).toHaveBeenCalledTimes(1);
    expect(accessRequests.releaseApprovalToken).not.toHaveBeenCalled();
  });

  it('does not create a new Shield checkout from a historical request', async () => {
    accessRequests.consumeApprovalToken.mockResolvedValue({
      tokenId: 'token-1',
      record: {
        id: 'request-legacy',
        email: 'client@example.com',
        tier: AccessRequestTier.SHIELD,
        legacyTier: 'RESEARCH',
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
      },
    });
    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).rejects.toThrow('historical request requires contract review');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(accessRequests.releaseApprovalToken).toHaveBeenCalledWith('token-1');
  });

  it.each([
    [AccessRequestTier.SHIELD, BillingPeriod.MONTHLY, 2_990_000, 'month'],
    [AccessRequestTier.SHIELD, BillingPeriod.ANNUAL, 29_900_000, 'year'],
  ])(
    'creates inline test pricing for %s %s',
    async (tier, billingPeriod, unitAmount, interval) => {
      accessRequests.consumeApprovalToken.mockResolvedValue({
        tokenId: 'token-1',
        record: {
          id: 'request-1',
          email: 'client@example.com',
          tier,
          status: AccessRequestStatus.AGREEMENT_ACCEPTED,
        },
      });
      stripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_inline',
        url: 'https://checkout.stripe.test/session',
      });

      await service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod,
      });

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              quantity: 1,
              price_data: expect.objectContaining({
                currency: 'php',
                unit_amount: unitAmount,
                recurring: { interval },
              }),
            }),
          ],
        }),
        expect.any(Object),
      );
    },
  );

  it('keeps live checkout fail-closed when a dashboard price is missing', async () => {
    process.env.STRIPE_CHECKOUT_MODE = 'live';
    delete process.env.STRIPE_PRICE_SHIELD_ANNUAL;

    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: BillingPeriod.ANNUAL,
      }),
    ).rejects.toThrow('not configured for live Stripe checkout');
    expect(accessRequests.releaseApprovalToken).toHaveBeenCalledWith('token-1');
  });

  it('releases the token reservation when Stripe fails', async () => {
    stripe.checkout.sessions.create.mockRejectedValue(new Error('network'));

    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).rejects.toThrow('network');
    expect(accessRequests.releaseApprovalToken).toHaveBeenCalledWith('token-1');
  });

  it('reconciles a paid Stripe test session without trusting the success URL', async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_paid_1',
      livemode: false,
      payment_status: 'paid',
      customer: 'cus_test_1',
      subscription: 'sub_test_1',
      metadata: { accessRequestId: 'request-1' },
    });
    accessRequests.activateFromWebhook.mockResolvedValue({
      activated: true,
      accessRequestId: 'request-1',
      organizationId: 'organization-1',
      emailDelivery: { status: 'sent', to: 'client@example.com' },
    });

    await expect(
      service.reconcileTestCheckout('cs_test_paid_1'),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'active',
        emailDelivery: { status: 'sent', to: 'client@example.com' },
      }),
    );
    expect(accessRequests.activateFromWebhook).toHaveBeenCalledWith({
      checkoutSessionId: 'cs_test_paid_1',
      expectedAccessRequestId: 'request-1',
      stripeCustomerId: 'cus_test_1',
      stripeSubscriptionId: 'sub_test_1',
    });
  });

  it('never exposes test reconciliation in production', async () => {
    process.env.NODE_ENV = 'production';

    await expect(
      service.reconcileTestCheckout('cs_test_paid_1'),
    ).rejects.toThrow('not available');
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('requires an explicit pilot flag for test checkout in production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).rejects.toThrow('STRIPE_TEST_PILOT=true');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();

    process.env.STRIPE_TEST_PILOT = 'true';
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_pilot',
      url: 'https://checkout.stripe.test/pilot',
    });
    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).resolves.toEqual({ url: 'https://checkout.stripe.test/pilot' });
  });

  it('reconciles a selected pending request through its server-stored session', async () => {
    accessRequests.getPaymentLifecycleRecord.mockResolvedValue({
      id: 'request-1',
      status: AccessRequestStatus.PAYMENT_PENDING,
      stripeCheckoutSessionId: 'cs_test_paid_1',
      license: null,
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_paid_1',
      livemode: false,
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_test_1',
      subscription: 'sub_test_1',
      metadata: { accessRequestId: 'request-1' },
    });
    accessRequests.activateFromWebhook.mockResolvedValue({
      activated: true,
      accessRequestId: 'request-1',
    });

    await expect(
      service.reconcileAccessRequestPayment('request-1'),
    ).resolves.toEqual(expect.objectContaining({ status: 'active' }));
  });

  it('activates a paid pending request instead of cancelling it', async () => {
    accessRequests.getPaymentLifecycleRecord.mockResolvedValue({
      id: 'request-1',
      status: AccessRequestStatus.PAYMENT_PENDING,
      stripeCheckoutSessionId: 'cs_test_paid_1',
      license: null,
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_paid_1',
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_test_1',
      subscription: 'sub_test_1',
      metadata: { accessRequestId: 'request-1' },
    });
    accessRequests.activateFromWebhook.mockResolvedValue({ activated: true });

    await expect(
      service.cancelAccessRequest('request-1', 'admin-1', 'Applicant asked'),
    ).rejects.toThrow('activated instead of cancelled');
    expect(accessRequests.activateFromWebhook).toHaveBeenCalled();
    expect(accessRequests.cancelUnpaid).not.toHaveBeenCalled();
  });

  it('expires an open unpaid checkout before cancelling its request', async () => {
    accessRequests.getPaymentLifecycleRecord.mockResolvedValue({
      id: 'request-1',
      status: AccessRequestStatus.PAYMENT_PENDING,
      stripeCheckoutSessionId: 'cs_test_open_1',
      license: null,
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_open_1',
      status: 'open',
      payment_status: 'unpaid',
      metadata: { accessRequestId: 'request-1' },
    });
    stripe.checkout.sessions.expire.mockResolvedValue({
      id: 'cs_test_open_1',
      status: 'expired',
      payment_status: 'unpaid',
      metadata: { accessRequestId: 'request-1' },
    });
    accessRequests.cancelUnpaid.mockResolvedValue({ status: 'CANCELLED' });

    await expect(
      service.cancelAccessRequest('request-1', 'admin-1', 'Applicant asked'),
    ).resolves.toEqual({ status: 'CANCELLED' });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(
      'cs_test_open_1',
    );
    expect(accessRequests.cancelUnpaid).toHaveBeenCalledWith(
      'request-1',
      'admin-1',
      'Applicant asked',
    );
  });

  it('refuses to delete a terminal request when Stripe reports it paid', async () => {
    accessRequests.getPaymentLifecycleRecord.mockResolvedValue({
      id: 'request-1',
      status: AccessRequestStatus.CANCELLED,
      stripeCheckoutSessionId: 'cs_test_paid_1',
      license: null,
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_paid_1',
      status: 'complete',
      payment_status: 'paid',
      metadata: { accessRequestId: 'request-1' },
    });

    await expect(
      service.deleteAccessRequest('request-1', 'admin-1', 'Duplicate record'),
    ).rejects.toThrow('cannot be deleted');
    expect(accessRequests.deleteTerminal).not.toHaveBeenCalled();
  });

  it('refuses checkout until the license agreement is accepted', async () => {
    accessRequests.consumeApprovalToken.mockResolvedValue({
      tokenId: 'token-1',
      record: {
        id: 'request-1',
        email: 'client@example.com',
        tier: AccessRequestTier.SHIELD,
        status: AccessRequestStatus.APPROVED,
      },
    });

    await expect(
      service.createCheckoutSession({
        token: 'a'.repeat(32),
        billingPeriod: 'ANNUAL',
      }),
    ).rejects.toThrow('not currently eligible for checkout');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(accessRequests.releaseApprovalToken).toHaveBeenCalledWith('token-1');
  });

  it('does not activate a completed checkout until Stripe reports it paid', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unpaid',
          status: 'complete',
          payment_status: 'unpaid',
          metadata: { accessRequestId: 'request-1' },
        },
      },
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true });
    expect(accessRequests.activateFromWebhook).not.toHaveBeenCalled();
  });

  it('activates an asynchronously paid checkout', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_paid',
          status: 'complete',
          payment_status: 'paid',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { accessRequestId: 'request-1' },
        },
      },
    });
    accessRequests.activateFromWebhook.mockResolvedValue({ activated: true });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true, activated: true });
    expect(accessRequests.activateFromWebhook).toHaveBeenCalledWith({
      checkoutSessionId: 'cs_paid',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeEventCreated: undefined,
    });
  });
});
