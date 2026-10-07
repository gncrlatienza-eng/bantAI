import { stripeClientProvider } from './stripe.provider';

describe('stripeClientProvider', () => {
  const factory = stripeClientProvider.useFactory as () => unknown;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    STRIPE_CHECKOUT_MODE: process.env.STRIPE_CHECKOUT_MODE,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_TEST_PILOT: process.env.STRIPE_TEST_PILOT,
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_CHECKOUT_MODE = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_pilot_placeholder';
    delete process.env.STRIPE_TEST_PILOT;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('rejects production-hosted test checkout without the pilot flag', () => {
    expect(factory).toThrow('STRIPE_TEST_PILOT=true');
  });

  it('accepts a test key only with the explicit production pilot flag', () => {
    process.env.STRIPE_TEST_PILOT = 'true';
    expect(factory).not.toThrow();
  });

  it('rejects a live key when checkout mode is test', () => {
    process.env.STRIPE_TEST_PILOT = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_live_wrong_for_test_pilot';
    expect(factory).toThrow('requires an sk_test_ secret key');
  });

  it('rejects a missing Stripe key', () => {
    process.env.STRIPE_TEST_PILOT = 'true';
    delete process.env.STRIPE_SECRET_KEY;
    expect(factory).toThrow('STRIPE_SECRET_KEY is required');
  });
});
