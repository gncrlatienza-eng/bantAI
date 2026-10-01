import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAccessRequestActionDto } from './dto/admin-access-request-action.dto';
import { PaymentsService } from './payments.service';

@SkipThrottle()
@Controller('admin/access-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAccessRequestPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/reconcile-payment')
  @HttpCode(HttpStatus.OK)
  reconcilePayment(@Param('id') id: string) {
    return this.payments.reconcileAccessRequestPayment(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() dto: AdminAccessRequestActionDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.payments.cancelAccessRequest(
      id,
      request.user.userId,
      dto.reason,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @Body() dto: AdminAccessRequestActionDto,
    @Request() request: { user: { userId: string } },
  ) {
    return this.payments.deleteAccessRequest(
      id,
      request.user.userId,
      dto.reason,
    );
  }
}
