import { Inject, Injectable, Logger } from '@nestjs/common';
import { AccessRequestTier, BillingPeriod } from '@prisma/client';
import Stripe from 'stripe';

import { STRIPE_CLIENT } from './stripe.provider';

/* Test-mode checkout charges these amounts (PHP centavos); live mode charges
   the configured Stripe Price objects. Both sources feed the price shown
   before the agreement, so the page and the charge cannot disagree. */
export const TEST_PRICE_CENTAVOS = {
  [AccessRequestTier.SHIELD]: {
    [BillingPeriod.MONTHLY]: 2_990_000,
    [BillingPeriod.ANNUAL]: 29_900_000,
  },
} as const;

export interface PriceLine {
  amountMinor: number;
  currency: string;
  interval: 'month' | 'year';
  /** e.g. "₱29,900.00 per month" — rendered verbatim on the agreement step. */
  display: string;
}

export interface LicensePricing {
  /** True only when both billing periods resolved to a real recurring price. */
  confirmed: boolean;
  annual: PriceLine | null;
  monthly: PriceLine | null;
}

const CACHE_MS = 10 * 60_000;
const INTERVAL: Record<BillingPeriod, 'month' | 'year'> = {
  [BillingPeriod.MONTHLY]: 'month',
  [BillingPeriod.ANNUAL]: 'year',
};

export function priceLine(
  amountMinor: number,
  currency: string,
  interval: 'month' | 'year',
): PriceLine {
  const amount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);
  return {
    amountMinor,
    currency: currency.toLowerCase(),
    interval,
    display: `${amount} per ${interval}`,
  };
}

/**
 * The recurring price an applicant will be charged, resolved from the same
 * source checkout uses (manual QA 2026-10-01, F1: the agreement step showed
 * "Configured in Stripe" while checkout charged PHP 29,900/month).
 */
@Injectable()
export class LicensePricingService {
  private readonly logger = new Logger(LicensePricingService.name);
  private readonly cache = new Map<
    string,
    { at: number; line: PriceLine | null }
  >();

  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  async pricing(tier: AccessRequestTier): Promise<LicensePricing> {
    const [annual, monthly] = await Promise.all([
      this.line(tier, BillingPeriod.ANNUAL),
      this.line(tier, BillingPeriod.MONTHLY),
    ]);
    return { confirmed: Boolean(annual && monthly), annual, monthly };
  }

  private async line(
    tier: AccessRequestTier,
    period: BillingPeriod,
  ): Promise<PriceLine | null> {
    if (checkoutMode() === 'test') {
      const amount = TEST_PRICE_CENTAVOS[tier]?.[period];
      return amount ? priceLine(amount, 'php', INTERVAL[period]) : null;
    }
    const priceId = livePriceId(tier, period);
    if (!priceId) return null;
    const cached = this.cache.get(priceId);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.line;
    let line: PriceLine | null = null;
    try {
      const price = await this.stripe.prices.retrieve(priceId);
      // A price that is not the recurring cadence it is configured for must
      // not be presented as that cadence.
      if (
        price.active &&
        typeof price.unit_amount === 'number' &&
        price.recurring?.interval === INTERVAL[period] &&
        (price.recurring.interval_count ?? 1) === 1
      ) {
        line = priceLine(price.unit_amount, price.currency, INTERVAL[period]);
      } else {
        this.logger.error(
          `Stripe price for ${tier} ${period} is inactive or not a ${INTERVAL[period]}ly recurring price.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not load the Stripe price for ${tier} ${period}: ${(error as Error).message}`,
      );
      return cached?.line ?? null;
    }
    this.cache.set(priceId, { at: Date.now(), line });
    return line;
  }
}

export function livePriceId(
  tier: AccessRequestTier,
  period: BillingPeriod,
): string | undefined {
  const table = {
    [AccessRequestTier.SHIELD]: {
      [BillingPeriod.MONTHLY]: process.env.STRIPE_PRICE_SHIELD_MONTHLY,
      [BillingPeriod.ANNUAL]: process.env.STRIPE_PRICE_SHIELD_ANNUAL,
    },
  } as const;
  return table[tier]?.[period]?.trim() || undefined;
}

export function checkoutMode(): 'test' | 'live' {
  const configured = process.env.STRIPE_CHECKOUT_MODE?.trim().toLowerCase();
  return configured === 'live' ||
    (!configured && process.env.NODE_ENV === 'production')
    ? 'live'
    : 'test';
}
