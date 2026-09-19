import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AiModelsKeyGuard } from '../auth/guards/api-key.guard';
import { CreateModelVersionDto } from './dto/create-model-version.dto';
import { ModelsService } from './models.service';

/** Narrow machine interface: candidate registration and active-version checks. */
@Controller('internal/models')
@UseGuards(AiModelsKeyGuard)
export class InternalModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('active')
  async findActive() {
    const model = await this.modelsService.findActive();
    if (!model) throw new NotFoundException('No active model version');
    return model;
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  register(@Body() dto: CreateModelVersionDto) {
    return this.modelsService.register(dto);
  }
}
