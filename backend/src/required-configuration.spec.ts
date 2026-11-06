import { assertRequiredConfiguration } from './required-configuration';

const BASE = {
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: 'x',
  OTP_HASH_SECRET: 'x',
  SENDER_HASH_SECRET: 'x',
  AI_SERVICE_API_KEY: 'x',
  AI_CAMPAIGNS_API_KEY: 'x',
  AI_MODELS_API_KEY: 'x',
  AI_INDICATORS_API_KEY: 'x',
  SEMAPHORE_API_KEY: 'x',
};

describe('assertRequiredConfiguration', () => {
  it('accepts a complete local configuration', () => {
    expect(() => assertRequiredConfiguration({ ...BASE })).not.toThrow();
  });

  it('requires the dataset key once retraining is enabled', () => {
    expect(() =>
      assertRequiredConfiguration({ ...BASE, RETRAINING_ENABLED: 'true' }),
    ).toThrow('Missing required configuration: AI_DATASETS_API_KEY');
    expect(() =>
      assertRequiredConfiguration({
        ...BASE,
        RETRAINING_ENABLED: 'true',
        AI_DATASETS_API_KEY: 'dataset-key',
      }),
    ).not.toThrow();
  });

  it('does not require the dataset key while retraining is off', () => {
    expect(() =>
      assertRequiredConfiguration({ ...BASE, RETRAINING_ENABLED: 'false' }),
    ).not.toThrow();
  });

  it('still requires the AI service key', () => {
    expect(() =>
      assertRequiredConfiguration({ ...BASE, AI_SERVICE_API_KEY: ' ' }),
    ).toThrow('AI_SERVICE_API_KEY');
  });
});
