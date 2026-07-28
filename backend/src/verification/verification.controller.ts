import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportSenderDto } from './dto/report-sender.dto';
import { SyncContactsDto } from './dto/sync-contacts.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  // Stage 1 → 2 sender verification:
  //   1. Check if sender is in user's synced contacts
  //   2. Check external API cache (stub until API is chosen)
  //   3. Return unknown + link suppression applies on the mobile side
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

  // User-submitted fraud report — immediately marks sender as fraud in cache.
  @UseGuards(JwtAuthGuard)
  @Post('sender/report')
  reportFraud(@Body() dto: ReportSenderDto) {
    return this.verificationService.reportFraud(dto.sender);
  }
}
