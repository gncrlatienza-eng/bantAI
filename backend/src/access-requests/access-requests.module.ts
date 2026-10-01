import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { ApplicantRequestsService } from './applicant-requests.service';
import { LicenseExpiryService } from './license-expiry.service';
import { AccessRequestEmailService } from './access-request-email.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccessRequestsController],
  providers: [
    AccessRequestsService,
    ApplicantRequestsService,
    AccessRequestEmailService,
    LicenseExpiryService,
  ],
  exports: [AccessRequestsService, ApplicantRequestsService],
})
export class AccessRequestsModule {}
