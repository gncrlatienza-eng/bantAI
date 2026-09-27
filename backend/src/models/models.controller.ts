import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateModelVersionDto } from './dto/create-model-version.dto';
import { ModelsService } from './models.service';

@Controller('models')
@UseGuards(JwtAuthGuard, StaffGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @RequirePermissions('models:read')
  @Get()
  findAll() {
    return this.modelsService.findAll();
  }

  @RequirePermissions('models:read')
  @Get('active')
  async findActive() {
    const model = await this.modelsService.findActive();
    if (!model) throw new NotFoundException('No active model version');
    return model;
  }

  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  register(@Body() dto: CreateModelVersionDto) {
    return this.modelsService.register(dto);
  }

  // Promote a registered model to production — replaces the currently active one.
  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/activate')
  promote(@Param('id') id: string) {
    return this.modelsService.promote(id);
  }

  // Rollback to a specific previous version when the active model degrades.
  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/rollback')
  rollback(@Param('id') id: string) {
    return this.modelsService.rollback(id);
  }
}
