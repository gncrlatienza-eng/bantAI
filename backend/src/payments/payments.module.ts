import { Module } from '@nestjs/common';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { AdminAccessRequestPaymentsController } from './admin-access-request-payments.controller';
import { PaymentsController } from './payments.controller';
import { LicensePricingService } from './license-pricing.service';
import { PaymentsService } from './payments.service';
import { stripeClientProvider } from './stripe.provider';

@Module({
  imports: [AccessRequestsModule],
  controllers: [PaymentsController, AdminAccessRequestPaymentsController],
  providers: [stripeClientProvider, PaymentsService, LicensePricingService],
  exports: [PaymentsService, LicensePricingService],
})
export class PaymentsModule {}
