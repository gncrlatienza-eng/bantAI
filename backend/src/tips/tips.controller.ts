import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSafetyTipDto } from './dto/create-safety-tip.dto';
import { UpdateSafetyTipDto } from './dto/update-safety-tip.dto';
import { TipsService } from './tips.service';

@Controller('admin/tips')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminTipsController {
  constructor(private readonly tips: TipsService) {}

  @Get()
  list() {
    return this.tips.listAdmin();
  }

  @Post()
  create(@Body() dto: CreateSafetyTipDto) {
    return this.tips.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSafetyTipDto) {
    return this.tips.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.tips.remove(id);
  }
}

@Controller('tips')
export class PublicTipsController {
  constructor(private readonly tips: TipsService) {}

  @Get()
  listPublished() {
    return this.tips.listPublished();
  }
}
