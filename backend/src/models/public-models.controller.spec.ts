import { PublicModelsController } from './public-models.controller';
import { ModelsService } from './models.service';

describe('PublicModelsController privacy surface', () => {
  const models = { findActive: jest.fn() };
  const controller = new PublicModelsController(
    models as unknown as ModelsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not expose model performance or internal fields', async () => {
    models.findActive.mockResolvedValue({
      versionTag: 'private-checkpoint-name',
      notes: 'private training details',
      promotedAt: new Date(),
      f1Score: 0.94,
      accuracy: 0.95,
    });
    const result = await controller.summary();
    expect(result).toEqual({ available: true });
    expect(result).not.toHaveProperty('macroF1');
    expect(result).not.toHaveProperty('accuracy');
    expect(result).not.toHaveProperty('versionTag');
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('promotedAt');
  });
});
