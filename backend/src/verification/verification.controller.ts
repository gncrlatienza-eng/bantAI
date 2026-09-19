import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReportSenderDto } from './dto/report-sender.dto';
import { ReviewSenderReportDto } from './dto/review-sender-report.dto';
import { SyncContactsDto } from './dto/sync-contacts.dto';
import { CreateTrustedOrganizationDto } from './dto/create-trusted-organization.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  // Familiarity (private contact or vetted organization) and risk are separate
  // fields. A community report can never make a sender appear familiar.
  @UseGuards(JwtAuthGuard)
  @Get('sender/:sender')
  verifySender(
    @Request() req: { user: { userId: string } },
    @Param('sender') sender: string,
  ) {
    return this.verificationService.verifySender(req.user.userId, sender);
  }

  // Mobile app calls this on first launch and when contacts change.
  // Syncs the user's Android contact list so Stage 1 verification works.
  @UseGuards(JwtAuthGuard)
  @Post('contacts/sync')
  syncContacts(
    @Request() req: { user: { userId: string } },
    @Body() dto: SyncContactsDto,
  ) {
    return this.verificationService.syncContacts(req.user.userId, dto.contacts);
  }

  // User-submitted fraud report. It remains pending until independently
  // corroborated and reviewed by an authenticated administrator.
  @Throttle({ global: { ttl: 60_000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @Post('sender/report')
  reportFraud(
    @Request() req: { user: { userId: string } },
    @Body() dto: ReportSenderDto,
  ) {
    return this.verificationService.reportFraud(req.user.userId, dto.sender);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('sender/pending-reports')
  pendingFraudReports() {
    return this.verificationService.findPendingFraudReports();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('sender/confirm-fraud')
  confirmFraud(
    @Request() req: { user: { userId: string } },
    @Body() dto: ReviewSenderReportDto,
  ) {
    return this.verificationService.confirmFraud(
      dto.reportId,
      req.user.userId,
      dto.reason,
    );
  }

  // Only an administrator can curate the global organization evidence layer.
  // The raw sender is HMACed immediately and never returned or persisted.
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('organizations')
  addTrustedOrganization(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateTrustedOrganizationDto,
  ) {
    return this.verificationService.addTrustedOrganization(
      req.user.userId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('organizations')
  listTrustedOrganizations() {
    return this.verificationService.listTrustedOrganizations();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('organizations/:id/deactivate')
  deactivateTrustedOrganization(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.verificationService.deactivateTrustedOrganization(
      id,
      req.user.userId,
    );
  }
}
