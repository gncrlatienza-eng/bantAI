import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { PortalAccount } from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @PortalAccount()
  @Put('me')
  updateMe(
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(req.user.userId, dto);
  }

  // Not @PortalAccount: deleting a portal identity would destroy the
  // application/license history it anchors. Mobile accounts are unaffected.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  async deleteMe(@Request() req: { user: { userId: string } }) {
    await this.usersService.deleteMe(req.user.userId);
  }
}
