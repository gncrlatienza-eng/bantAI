import { Controller, Get } from '@nestjs/common';

import { ModelsService } from './models.service';

/*
 * Public readiness surface. Model performance is internal operational data
 * and must not be serialized to unauthenticated or Shield callers.
 */
@Controller('models/public-summary')
export class PublicModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  async summary(): Promise<{ available: boolean }> {
    const model = await this.modelsService.findActive();
    return { available: Boolean(model) };
  }
}
