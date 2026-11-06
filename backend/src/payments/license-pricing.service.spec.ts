import { AccessRequestTier } from '@prisma/client';

import { LicensePricingService } from './license-pricing.service';

describe('LicensePricingService', () => {
  const env = { ...process.env };
  const retrieve = jest.fn();
  const service = () =>
    new LicensePricingService({ prices: { retrieve } } as never);

  afterEach(() => {
    process.env = { ...env };
    jest.clearAllMocks();
  });

  it('shows the exact amounts test checkout charges, with their cadence', async () => {
    process.env.STRIPE_CHECKOUT_MODE = 'test';
    const pricing = await service().pricing(AccessRequestTier.SHIELD);

    expect(pricing).toEqual({
      confirmed: true,
      monthly: {
        amountMinor: 2_990_000,
        currency: 'php',
        interval: 'month',
        display: '₱29,900.00 per month',
      },
      annual: {
        amountMinor: 29_900_000,
        currency: 'php',
        interval: 'year',
        display: '₱299,000.00 per year',
      },
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('reads live prices from the configured Stripe Price objects', async () => {
    process.env.STRIPE_CHECKOUT_MODE = 'live';
    process.env.STRIPE_PRICE_SHIELD_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_SHIELD_ANNUAL = 'price_annual';
    retrieve.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'price_monthly'
          ? {
              active: true,
              unit_amount: 2_990_000,
              currency: 'php',
              recurring: { interval: 'month', interval_count: 1 },
            }
          : {
              active: true,
              unit_amount: 29_900_000,
              currency: 'php',
              recurring: { interval: 'year', interval_count: 1 },
            },
      ),
    );

    const pricing = await service().pricing(AccessRequestTier.SHIELD);

    expect(pricing.confirmed).toBe(true);
    expect(pricing.monthly?.display).toBe('₱29,900.00 per month');
    expect(pricing.annual?.display).toBe('₱299,000.00 per year');
  });

  it.each([
    ['an unconfigured price', {}, undefined],
    [
      'a price with the wrong cadence',
      { STRIPE_PRICE_SHIELD_MONTHLY: 'p', STRIPE_PRICE_SHIELD_ANNUAL: 'p' },
      {
        active: true,
        unit_amount: 100,
        currency: 'php',
        recurring: { interval: 'week' },
      },
    ],
  ])('is not confirmed for %s', async (_name, prices, stripePrice) => {
    process.env.STRIPE_CHECKOUT_MODE = 'live';
    delete process.env.STRIPE_PRICE_SHIELD_MONTHLY;
    delete process.env.STRIPE_PRICE_SHIELD_ANNUAL;
    Object.assign(process.env, prices);
    retrieve.mockResolvedValue(stripePrice);

    const pricing = await service().pricing(AccessRequestTier.SHIELD);

    expect(pricing.confirmed).toBe(false);
  });

  it('is not confirmed when Stripe cannot be reached', async () => {
    process.env.STRIPE_CHECKOUT_MODE = 'live';
    process.env.STRIPE_PRICE_SHIELD_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_SHIELD_ANNUAL = 'price_annual';
    retrieve.mockRejectedValue(new Error('network down'));

    await expect(
      service().pricing(AccessRequestTier.SHIELD),
    ).resolves.toMatchObject({ confirmed: false, monthly: null });
  });
});
