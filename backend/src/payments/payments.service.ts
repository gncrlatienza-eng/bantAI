import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import Stripe from 'stripe';
import {
  AccessRequestStatus,
  AccessRequestTier,
  BillingPeriod,
} from '@prisma/client';
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { STRIPE_CLIENT } from './stripe.provider';

interface CheckoutRequest {
  token: string;
  billingPeriod: BillingPeriod;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly accessRequests: AccessRequestsService,
  ) {}

  async createCheckoutSession(dto: CheckoutRequest) {
    const record = await this.accessRequests.consumeApprovalToken(dto.token);
    if (record.status !== AccessRequestStatus.APPROVED) {
      throw new BadRequestException(
        'This request is not currently eligible for checkout.',
      );
    }

    const priceId = this.priceIdFor(record.tier, dto.billingPeriod);
    if (!priceId) {
      throw new InternalServerErrorException(
        'This license and billing period is not configured for Stripe. Contact the research team.',
      );
    }

    const frontendUrl = this.frontendUrl();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      // Same email the applicant used on the request. Stripe uses it for the
      // receipt and matches it to a Customer record if one already exists.
      customer_email: record.email,
      line_items: [{ price: priceId, quantity: 1 }],
      // We stash the access-request id in metadata so the webhook can find
      // it back without trusting anything in the URL.
      metadata: {
        accessRequestId: record.id,
        tier: record.tier,
        billingPeriod: dto.billingPeriod,
      },
      subscription_data: {
        metadata: {
          accessRequestId: record.id,
          tier: record.tier,
          billingPeriod: dto.billingPeriod,
        },
      },
      // Note the success URL points to a passive "we're waiting for payment
      // confirmation" screen. Access is not granted here — the webhook does
      // that, and the success screen simply reports what the webhook has (or
      // has not yet) done.
      success_url: `${frontendUrl}/request-access/pending?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/request-access/cancelled`,
      allow_promotion_codes: false,
    });

    if (!session.id || !session.url) {
      throw new InternalServerErrorException(
        'Stripe returned an incomplete checkout session. Please try again.',
      );
    }

    await this.accessRequests.attachCheckoutSession(
      record.id,
      session.id,
      dto.billingPeriod,
    );

    return { url: session.url };
  }

  /*
   * Called by the webhook controller with the raw request body Stripe signed.
   * We construct the event from the buffer + signature header — this is the
   * only signal we trust for activating access. A browser reaching a success
   * URL is not proof of payment; a signed webhook is.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET is not configured; refusing to process webhooks blindly.',
      );
    }
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe signature.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid Stripe signature.');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.payment_status !== 'paid' &&
          session.status !== 'complete'
        ) {
          this.logger.log(
            `Ignoring session ${session.id}: status=${session.status} payment_status=${session.payment_status}`,
          );
          return { received: true };
        }
        const activated = await this.accessRequests.activateFromWebhook({
          checkoutSessionId: session.id,
          stripeCustomerId:
            typeof session.customer === 'string' ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === 'string'
              ? session.subscription
              : null,
        });
        return { received: true, activated: activated.activated };
      }
      default:
        // Every other event is acknowledged but not acted on — Stripe expects
        // 2xx or it retries. Access mutation only happens on the events above.
        return { received: true };
    }
  }

  private priceIdFor(tier: AccessRequestTier, period: BillingPeriod) {
    const table = {
      [AccessRequestTier.RESEARCH]: {
        [BillingPeriod.MONTHLY]: process.env.STRIPE_PRICE_RESEARCH_MONTHLY,
        [BillingPeriod.ANNUAL]: process.env.STRIPE_PRICE_RESEARCH_ANNUAL,
      },
      [AccessRequestTier.ORGANIZATION]: {
        [BillingPeriod.MONTHLY]: process.env.STRIPE_PRICE_ORGANIZATION_MONTHLY,
        [BillingPeriod.ANNUAL]: process.env.STRIPE_PRICE_ORGANIZATION_ANNUAL,
      },
    } as const;
    return table[tier]?.[period]?.trim() || undefined;
  }

  private frontendUrl() {
    const url = process.env.FRONTEND_URL?.trim();
    if (!url) {
      throw new InternalServerErrorException(
        'FRONTEND_URL is required to build Stripe redirect URLs.',
      );
    }
    return url.replace(/\/+$/, '');
  }
}
