import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillingPeriod } from '@prisma/client';

describe('PaymentsController (W8)', () => {
  let controller: PaymentsController;
  let mockPaymentsService: any;

  beforeEach(async () => {
    mockPaymentsService = {
      createCheckoutSession: jest.fn(),
      handleWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('delegates to PaymentsService with DTO', async () => {
      const dto = { token: 'tok_123', billingPeriod: BillingPeriod.ANNUAL };
      mockPaymentsService.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/...' });

      const result = await controller.createCheckoutSession(dto);
      expect(mockPaymentsService.createCheckoutSession).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ url: 'https://checkout.stripe.com/...' });
    });
  });

  describe('webhook', () => {
    it('passes rawBody buffer and signature to PaymentsService', async () => {
      const rawBuffer = Buffer.from('{"id":"evt_123"}');
      const req: any = { rawBody: rawBuffer };
      const signature = 't=123,v1=sig_hash';

      mockPaymentsService.handleWebhook.mockResolvedValue({ received: true, activated: true });

      const result = await controller.webhook(req, signature);
      expect(mockPaymentsService.handleWebhook).toHaveBeenCalledWith(rawBuffer, signature);
      expect(result).toEqual({ received: true, activated: true });
    });

    it('throws error if rawBody is missing on webhook request', () => {
      const req: any = { rawBody: undefined };
      expect(() => controller.webhook(req, 'sig')).toThrow(
        /Raw body missing on Stripe webhook route/,
      );
      expect(mockPaymentsService.handleWebhook).not.toHaveBeenCalled();
    });
  });
});
