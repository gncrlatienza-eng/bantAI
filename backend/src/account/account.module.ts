import { Module } from '@nestjs/common';

import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountController } from './account.controller';
import { AccountSetupService } from './account-setup.service';
import { AccountStateService } from './account-state.service';

@Module({
  imports: [AccessRequestsModule, PaymentsModule],
  controllers: [AccountController],
  providers: [AccountStateService, AccountSetupService],
  exports: [AccountStateService],
})
export class AccountModule {}
