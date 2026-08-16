import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { BlockedNumbersService } from './blocked-numbers.service';
import { BlockNumberDto } from './dto/block-number.dto';

@UseGuards(JwtAuthGuard)
@Controller('blocked-numbers')
export class BlockedNumbersController {
  constructor(private readonly blockedNumbersService: BlockedNumbersService) {}

  @Get()
  list(@Request() req: { user: { userId: string } }) {
    return this.blockedNumbersService.list(req.user.userId);
  }

  @Post()
  block(
    @Request() req: { user: { userId: string } },
    @Body() dto: BlockNumberDto,
  ) {
    return this.blockedNumbersService.block(req.user.userId, dto.sender);
  }

  // :sender rather than :id — the mobile client only ever knows the phone
  // number (from Android's own BlockedNumberContract), never a backend row id.
  @Delete(':sender')
  unblock(
    @Request() req: { user: { userId: string } },
    @Param('sender') sender: string,
  ) {
    return this.blockedNumbersService.unblock(req.user.userId, sender);
  }
}
