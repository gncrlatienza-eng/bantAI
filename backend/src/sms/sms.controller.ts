import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('ingest')
  ingest(
    @Request() req: { user: { userId: string } },
    @Body() dto: IngestSmsDto,
  ) {
    return this.smsService.ingest(req.user.userId, dto);
  }
}
