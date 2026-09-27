import {
  Body,
  Controller,
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
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { DeclineAccessRequestDto } from './dto/decide-access-request.dto';
import { ResolveAccessTokenDto } from './dto/resolve-access-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/*
 * Public + admin surface for the licensing workflow.
 *
 *   POST   /api/access-requests                    — public, applicant submits a request
 *   POST   /api/access-requests/resolve-token      — public, applicant resolves an approval token
 *
 *   GET    /api/admin/access-requests              — admin lists requests
 *   GET    /api/admin/access-requests/:id          — admin reads one request
 *   POST   /api/admin/access-requests/:id/approve  — admin approves and mints an approval token
 *   POST   /api/admin/access-requests/:id/decline  — admin declines with an optional reason
 */

@Controller()
export class AccessRequestsController {
  constructor(private readonly svc: AccessRequestsService) {}

  // 5 submissions per IP per minute — matches the auth register throttle.
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('access-requests')
  create(@Body() dto: CreateAccessRequestDto) {
    return this.svc.create(dto);
  }

  // Applicant-facing status lookup keyed by the approval token. Keep the
  // credential in the JSON body so it is not copied into URL/access logs.
  @Throttle({ global: { ttl: 60_000, limit: 30 } })
  @Post('access-requests/resolve-token')
  @HttpCode(HttpStatus.OK)
  resolveToken(@Body() dto: ResolveAccessTokenDto) {
    return this.svc.findApprovedByToken(dto.token);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/access-requests')
  list(@Query('status') status?: AccessRequestStatus) {
    return this.svc.list({ status });
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/access-requests/:id')
  read(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/access-requests/:id/approve')
  approve(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.svc.approve(id, req.user.userId);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/access-requests/:id/decline')
  decline(
    @Param('id') id: string,
    @Body() dto: DeclineAccessRequestDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.svc.decline(id, req.user.userId, dto.reason);
  }
}
