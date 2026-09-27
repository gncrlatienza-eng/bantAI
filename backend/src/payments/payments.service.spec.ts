import { AccessRequestStatus, AccessRequestTier } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService checkout idempotency', () => {
  const stripe = {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  };
  const accessRequests = {
    consumeApprovalToken: jest.fn(),
    releaseApprovalToken: jest.fn(),
    attachCheckoutSession: jest.fn(),
    activateFromWebhook: jest.fn(),
  };
  const service = new PaymentsService(stripe as never, accessRequests as never);

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.STRIPE_PRICE_RESEARCH_ANNUAL = 'price_research_annual';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    accessRequests.consumeApprovalToken.mockResolvedValue({
      tokenId: 'token-1',
      record: {
        id: 'request-1',
        email: 'client@example.com',
        tier: AccessRequestTier.RESEARCH,
        status: AccessRequestStatus.APPROVED,
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
    });
  });
});
