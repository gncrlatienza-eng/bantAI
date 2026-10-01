import {
  Body,
  Controller,
  GoneException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AccessRequestStatus } from '@prisma/client';
import { AccessRequestsService } from './access-requests.service';
import {
  DeclineAccessRequestDto,
  RequestMoreInfoDto,
} from './dto/decide-access-request.dto';
import {
  AcceptAgreementDto,
  ResolveAccessTokenDto,
} from './dto/resolve-access-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

/*
 * Public + admin surface for the licensing workflow.
 *
 *   POST   /api/access-requests                    — retired (410); applicants use POST /api/account/applications
 *   POST   /api/access-requests/resolve-token      — public, applicant resolves an approval token
 *   POST   /api/access-requests/accept-agreement   — public, applicant accepts the license terms (token)
 *
 *   GET    /api/admin/access-requests                   — admin lists requests
 *   GET    /api/admin/access-requests/:id               — admin reads one request
 *   POST   /api/admin/access-requests/:id/start-review  — admin moves a request into review
 *   POST   /api/admin/access-requests/:id/request-info  — admin asks the applicant for more detail
 *   POST   /api/admin/access-requests/:id/approve       — admin approves and mints an approval token
 *   POST   /api/admin/access-requests/:id/resend-approval-email — admin rotates and resends the private link
 *   POST   /api/admin/access-requests/:id/decline       — admin declines with an optional reason
 */

@Controller()
export class AccessRequestsController {
  constructor(private readonly svc: AccessRequestsService) {}

  // 5 submissions per IP per minute — matches the auth register throttle.
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('access-requests')
  create() {
    // Account-first lifecycle (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md
    // §A.1): an anonymous submission can never become the canonical request.
    throw new GoneException(
      'Access requests are submitted from a signed-in BantAI account. Create an account or sign in to continue.',
    );
  }

  // Applicant-facing status lookup keyed by the approval token. Keep the
  // credential in the JSON body so it is not copied into URL/access logs.
  @Throttle({ global: { ttl: 60_000, limit: 30 } })
  @Post('access-requests/resolve-token')
  @HttpCode(HttpStatus.OK)
  resolveToken(@Body() dto: ResolveAccessTokenDto) {
    return this.svc.findApprovedByToken(dto.token);
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @Post('access-requests/accept-agreement')
  @HttpCode(HttpStatus.OK)
  acceptAgreement(@Body() dto: AcceptAgreementDto) {
    return this.svc.acceptAgreement(dto.token, dto.agreementVersion);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Get('admin/access-requests')
  list(@Query('status') status?: AccessRequestStatus) {
    return this.svc.list({ status });
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Get('admin/access-requests/:id')
  read(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/start-review')
  @HttpCode(HttpStatus.OK)
  startReview(@Param('id') id: string) {
    return this.svc.startReview(id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/request-info')
  @HttpCode(HttpStatus.OK)
  requestMoreInfo(@Param('id') id: string, @Body() dto: RequestMoreInfoDto) {
    return this.svc.requestMoreInfo(id, dto.message);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/approve')
  approve(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.svc.approve(id, req.user.userId);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/resend-approval-email')
  resendApprovalEmail(@Param('id') id: string) {
    return this.svc.resendApprovalEmail(id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/resend-activation-email')
  resendActivationEmail(@Param('id') id: string) {
    return this.svc.resendActivationEmail(id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @RequirePermissions('access_requests:manage')
  @Post('admin/access-requests/:id/decline')
  decline(
    @Param('id') id: string,
    @Body() dto: DeclineAccessRequestDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.svc.decline(id, req.user.userId, dto.reason);
  }
}
