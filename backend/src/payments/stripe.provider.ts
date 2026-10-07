import { Provider } from '@nestjs/common';
import Stripe from 'stripe';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

/*
 * Instantiate one Stripe SDK client for the whole app. Refuses to boot
 * without a secret key — Stripe calls that fall back to unauthenticated
 * requests would leak nothing but would silently break every payment path.
 */
export const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: () => {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is required — refusing to boot the payments module without it.',
      );
    }
    const configuredMode =
      process.env.STRIPE_CHECKOUT_MODE?.trim().toLowerCase();
    const mode =
      configuredMode ||
      (process.env.NODE_ENV === 'production' ? 'live' : 'test');
    if (!['test', 'live'].includes(mode)) {
      throw new Error('STRIPE_CHECKOUT_MODE must be either test or live.');
    }
    if (mode === 'test' && !key.startsWith('sk_test_')) {
      throw new Error('Stripe test checkout requires an sk_test_ secret key.');
    }
    if (mode === 'live' && !key.startsWith('sk_live_')) {
      throw new Error('Stripe live checkout requires an sk_live_ secret key.');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      mode !== 'live' &&
      process.env.STRIPE_TEST_PILOT !== 'true'
    ) {
      throw new Error(
        'Stripe test checkout in production requires STRIPE_TEST_PILOT=true.',
      );
    }
    return new Stripe(key, {
      // Pin the API version so a Stripe-side release cannot silently change
      // webhook payload shape or checkout-session behavior on us.
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  },
};
