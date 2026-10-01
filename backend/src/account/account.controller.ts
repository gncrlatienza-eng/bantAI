import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import { PortalAccount } from '../access-control/portal-route.decorator';
import { ApplicantRequestsService } from '../access-requests/applicant-requests.service';
import {
  AcceptApplicationAgreementDto,
  StartApplicationCheckoutDto,
  SubmitApplicationDto,
} from '../access-requests/dto/submit-application.dto';
import { AuthAudience } from '../auth/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicensePricingService } from '../payments/license-pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { ClientAudienceGuard } from '../portal-organizations/client-audience.guard';
import {
  AccountSetupService,
  ACCOUNT_TERMS_VERSION,
} from './account-setup.service';
import { AccountStateService } from './account-state.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';

type Session = { user: { userId: string; audience: AuthAudience } };

/*
 * Signed-in account lifecycle surface. None of these routes needs a license:
 * they are how pending, declined, expired, and unfinished accounts move
 * forward. Licensed data stays behind PortalRoutePolicy.
 *
 *   GET  /api/account/state                               — authoritative lifecycle state
 *   POST /api/account/setup                               — finish mandatory setup
 *   GET  /api/account/applications                        — own request history
 *   GET  /api/account/applications/prefill                — safe facts for a re-request
 *   POST /api/account/applications                        — submit a request
 *   POST /api/account/applications/:id/withdraw           — withdraw before payment
 *   POST /api/account/applications/:id/accept-agreement   — accept license terms
 *   POST /api/account/applications/:id/checkout           — start/resume payment
 */
@Controller('account')
export class AccountController {
  constructor(
    private readonly state: AccountStateService,
    private readonly setup: AccountSetupService,
    private readonly applicants: ApplicantRequestsService,
    private readonly payments: PaymentsService,
    private readonly pricing: LicensePricingService,
  ) {}

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @PortalAccount()
  @Get('state')
  getState(@Request() req: Session) {
    return this.state.resolve(req.user);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @Get('setup/terms')
  terms() {
    return { version: ACCOUNT_TERMS_VERSION };
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async completeSetup(@Request() req: Session, @Body() dto: CompleteSetupDto) {
    await this.setup.complete(req.user.userId, dto);
    return this.state.resolve(req.user);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @Get('applications')
  listApplications(@Request() req: Session) {
    return this.applicants.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @Get('applications/prefill')
  async prefill(@Request() req: Session) {
    await this.state.assertSetupComplete(req.user.userId);
    return this.applicants.prefill(req.user.userId);
  }

  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @HttpCode(HttpStatus.CREATED)
  @Post('applications')
  submit(@Request() req: Session, @Body() dto: SubmitApplicationDto) {
    return this.applicants.submit(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @HttpCode(HttpStatus.OK)
  @Post('applications/:id/withdraw')
  withdraw(@Request() req: Session, @Param('id') id: string) {
    return this.applicants.withdraw(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @HttpCode(HttpStatus.OK)
  @Post('applications/:id/accept-agreement')
  async acceptAgreement(
    @Request() req: Session,
    @Param('id') id: string,
    @Body() dto: AcceptApplicationAgreementDto,
  ) {
    await this.state.assertSetupComplete(req.user.userId);
    // Terms are only accepted against a price the applicant could see: if
    // the recurring amount cannot be resolved, nothing is accepted.
    const record = await this.applicants.findOwned(req.user.userId, id);
    const pricing = await this.pricing.pricing(record.tier);
    if (!pricing.confirmed) {
      throw new ConflictException({
        code: 'PRICE_UNAVAILABLE',
        message:
          'The subscription price could not be confirmed right now, so the terms cannot be accepted yet. Please try again shortly.',
      });
    }
    return this.applicants.acceptAgreement(
      req.user.userId,
      id,
      dto.agreementVersion,
    );
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @UseGuards(JwtAuthGuard, ClientAudienceGuard)
  @PortalAccount()
  @HttpCode(HttpStatus.OK)
  @Post('applications/:id/checkout')
  async checkout(
    @Request() req: Session,
    @Param('id') id: string,
    @Body() dto: StartApplicationCheckoutDto,
  ) {
    await this.state.assertSetupComplete(req.user.userId);
    return this.payments.createCheckoutForUser(
      req.user.userId,
      id,
      dto.billingPeriod,
    );
  }
}
