import { Module } from '@nestjs/common';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { stripeClientProvider } from './stripe.provider';

@Module({
  imports: [AccessRequestsModule],
  controllers: [PaymentsController],
  providers: [stripeClientProvider, PaymentsService],
})
export class PaymentsModule {}
