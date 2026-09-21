import { Controller, Get } from '@nestjs/common';

import { ModelsService } from './models.service';

/*
 * Public model surface. Serves only the aggregate data the landing page needs
 * so unauthenticated visitors can see live macro-F1 without hitting the guarded
 * /models routes. Never returns dataset contents, evaluation samples, training
 * configuration, or any administrative model-management data.
 */
@Controller('models/public-summary')
export class PublicModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  async summary(): Promise<{
    macroF1: number | null;
    accuracy: number | null;
    versionTag: string | null;
    promotedAt: string | null;
  }> {
    const model = await this.modelsService.findActive();
    if (!model) {
      return {
        macroF1: null,
        accuracy: null,
        versionTag: null,
        promotedAt: null,
      };
    }
    return {
      macroF1: model.f1Score,
      accuracy: model.accuracy ?? null,
      versionTag: model.versionTag,
      promotedAt: model.promotedAt?.toISOString?.() ?? null,
    };
  }
}
