import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

  // "Nothing promoted yet" is a normal state for a fresh environment, not an
  // error: the AI service's startup check (ai/retraining/registry.py
  // get_active) reads an empty 200 body as "none registered" and logs it
  // plainly, whereas a 404 made it report the backend as unreachable.
  @Get('active')
  async findActive() {
    return (await this.modelsService.findActive()) ?? null;
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  register(@Body() dto: CreateModelVersionDto) {
    return this.modelsService.register(dto);
  }
}
