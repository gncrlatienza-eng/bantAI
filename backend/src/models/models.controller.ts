import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CreateModelVersionDto } from './dto/create-model-version.dto';
import { ModelsService } from './models.service';

@Controller('models')
@UseGuards(ApiKeyGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  findAll() {
    return this.modelsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.modelsService.findActive();
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  register(@Body() dto: CreateModelVersionDto) {
    return this.modelsService.register(dto);
  }

  // Promote a registered model to production — replaces the currently active one.
  @HttpCode(HttpStatus.OK)
  @Post(':id/activate')
  promote(@Param('id') id: string) {
    return this.modelsService.promote(id);
  }

  // Rollback to a specific previous version when the active model degrades.
  @HttpCode(HttpStatus.OK)
  @Post(':id/rollback')
  rollback(@Param('id') id: string) {
    return this.modelsService.rollback(id);
  }
}
