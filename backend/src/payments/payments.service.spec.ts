import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccessRequestStatus,
  AccessRequestTier,
  BillingPeriod,
} from '@prisma/client';
import { PaymentsService } from './payments.service';
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { STRIPE_CLIENT } from './stripe.provider';

describe('PaymentsService (W8 - Preserve Checkout Activation Security)', () => {
  let service: PaymentsService;
  let mockStripe: any;
  let mockAccessRequests: any;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      FRONTEND_URL: 'https://bantai.ph',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_12345',
      STRIPE_PRICE_RESEARCH_MONTHLY: 'price_res_mo_123',
      STRIPE_PRICE_RESEARCH_ANNUAL: 'price_res_yr_123',
      STRIPE_PRICE_ORGANIZATION_MONTHLY: 'price_org_mo_123',
      STRIPE_PRICE_ORGANIZATION_ANNUAL: 'price_org_yr_123',
    };

    mockStripe = {
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    mockAccessRequests = {
      consumeApprovalToken: jest.fn(),
      attachCheckoutSession: jest.fn(),
      activateFromWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        { provide: AccessRequestsService, useValue: mockAccessRequests },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('createCheckoutSession (Non-Authoritative Success URL)', () => {
    it('creates a Stripe checkout session with a pending success_url without activating access', async () => {
      mockAccessRequests.consumeApprovalToken.mockResolvedValue({
        id: 'req_123',
        email: 'researcher@example.com',
        tier: AccessRequestTier.RESEARCH,
        status: AccessRequestStatus.APPROVED,
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_session_abc',
        url: 'https://checkout.stripe.com/c/pay/cs_test_session_abc',
      });

      const result = await service.createCheckoutSession({
        token: 'valid_approval_token',
        billingPeriod: BillingPeriod.ANNUAL,
      });

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/c/pay/cs_test_session_abc',
      });

      // Verify success_url points ONLY to the passive /request-access/pending page
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url:
            'https://bantai.ph/request-access/pending?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://bantai.ph/request-access/cancelled',
          customer_email: 'researcher@example.com',
          line_items: [{ price: 'price_res_yr_123', quantity: 1 }],
          metadata: expect.objectContaining({
            accessRequestId: 'req_123',
            tier: AccessRequestTier.RESEARCH,
            billingPeriod: BillingPeriod.ANNUAL,
          }),
        }),
      );

      // Verify that attachCheckoutSession is called (linking session to request), but NOT activateFromWebhook
      expect(mockAccessRequests.attachCheckoutSession).toHaveBeenCalledWith(
        'req_123',
        'cs_test_session_abc',
        BillingPeriod.ANNUAL,
      );
      expect(mockAccessRequests.activateFromWebhook).not.toHaveBeenCalled();
    });

    it('rejects checkout creation if the request is not APPROVED', async () => {
      mockAccessRequests.consumeApprovalToken.mockResolvedValue({
        id: 'req_123',
        email: 'researcher@example.com',
        tier: AccessRequestTier.RESEARCH,
        status: AccessRequestStatus.PAYMENT_PENDING,
      });

      await expect(
        service.createCheckoutSession({
          token: 'already_used_token',
          billingPeriod: BillingPeriod.ANNUAL,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook (Authoritative Activation Gate)', () => {
    it('activates access only upon receiving a verified checkout.session.completed paid event', async () => {
      const fakeBuffer = Buffer.from(
        JSON.stringify({ type: 'checkout.session.completed' }),
      );
      const fakeSignature = 't=123,v1=signature_hash';

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_abc',
            customer: 'cus_123',
            subscription: 'sub_456',
            payment_status: 'paid',
            status: 'complete',
          },
        },
      });

      mockAccessRequests.activateFromWebhook.mockResolvedValue({
        activated: true,
      });

      const res = await service.handleWebhook(fakeBuffer, fakeSignature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        fakeBuffer,
        fakeSignature,
        'whsec_test_secret_12345',
      );
      expect(mockAccessRequests.activateFromWebhook).toHaveBeenCalledWith({
        checkoutSessionId: 'cs_test_session_abc',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      });
      expect(res).toEqual({ received: true, activated: true });
    });

    it('rejects activation if Stripe signature is missing', async () => {
      const fakeBuffer = Buffer.from('test-body');
      await expect(
        service.handleWebhook(fakeBuffer, undefined),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAccessRequests.activateFromWebhook).not.toHaveBeenCalled();
    });

    it('rejects activation if Stripe signature verification fails', async () => {
      const fakeBuffer = Buffer.from('tampered-body');
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      await expect(
        service.handleWebhook(fakeBuffer, 'invalid_sig'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAccessRequests.activateFromWebhook).not.toHaveBeenCalled();
    });

    it('does NOT activate access if payment_status is unpaid and session is incomplete', async () => {
      const fakeBuffer = Buffer.from('event-body');
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_unpaid_session',
            payment_status: 'unpaid',
            status: 'open',
          },
        },
      });

      const res = await service.handleWebhook(fakeBuffer, 'valid_sig');

      expect(mockAccessRequests.activateFromWebhook).not.toHaveBeenCalled();
      expect(res).toEqual({ received: true });
    });

    it('is idempotent when the same webhook is redelivered', async () => {
      const fakeBuffer = Buffer.from('event-body');
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_abc',
            customer: 'cus_123',
            subscription: 'sub_456',
            payment_status: 'paid',
            status: 'complete',
          },
        },
      });

      // Second delivery: row was already ACTIVE, so activated: false
      mockAccessRequests.activateFromWebhook.mockResolvedValue({
        activated: false,
      });

      const res = await service.handleWebhook(fakeBuffer, 'valid_sig');

      expect(res).toEqual({ received: true, activated: false });
    });
  });
});
