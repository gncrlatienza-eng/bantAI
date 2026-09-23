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
    return new Stripe(key, {
      // Pin the API version so a Stripe-side release cannot silently change
      // webhook payload shape or checkout-session behavior on us.
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  },
};
