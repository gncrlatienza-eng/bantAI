import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudVerificationService } from './cloud-verification.service';

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class CloudVerificationController {
  constructor(private readonly verification: CloudVerificationService) {}

  @Get(':messageId/verification')
  get(
    @Request() request: { user: { userId: string } },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ) {
    return this.verification.getForOwner(request.user.userId, messageId);
  }

  @Post(':messageId/verification/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ global: { ttl: 60_000, limit: 3 } })
  retry(
    @Request() request: { user: { userId: string } },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ) {
    return this.verification.retryForOwner(request.user.userId, messageId);
  }
}

@Controller('ai/readiness')
@UseGuards(JwtAuthGuard)
export class ModelWakeController {
  constructor(private readonly verification: CloudVerificationService) {}

  @Post('wake')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ global: { ttl: 60_000, limit: 2 } })
  wake(@Request() request: { user: { userId: string } }) {
    return this.verification.wake(request.user.userId);
  }
}
