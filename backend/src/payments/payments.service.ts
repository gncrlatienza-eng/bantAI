import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  LicenseStatus,
} from '@prisma/client';
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { ApplicantRequestsService } from '../access-requests/applicant-requests.service';
import { livePriceId, TEST_PRICE_CENTAVOS } from './license-pricing.service';
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
    private readonly applicants: ApplicantRequestsService,
  ) {}

  /*
   * Signed-in checkout (account-first lifecycle). The session proves which
   * account owns the request, so no approval token is involved. Only the
   * verified webhook activates access; the return URLs grant nothing.
   */
  async createCheckoutForUser(
    userId: string,
    accessRequestId: string,
    billingPeriod: BillingPeriod,
  ) {
    let record = await this.applicants.findOwned(userId, accessRequestId);
    if (record.legacyTier) {
      throw new BadRequestException(
        'This historical request requires contract review before a new checkout.',
      );
    }
    if (
      record.status === AccessRequestStatus.PAYMENT_PENDING &&
      record.stripeCheckoutSessionId
    ) {
      const existing = await this.retrieveBoundSession(
        record.stripeCheckoutSessionId,
        record.id,
      );
      if (
        existing.payment_status === 'paid' ||
        existing.status === 'complete'
      ) {
        return { status: 'processing' as const };
      }
      if (existing.status === 'open' && existing.url) {
        return { status: 'open' as const, url: existing.url };
      }
      // The abandoned session expired unpaid: let the owner start a new one.
      await this.accessRequests.releaseExpiredCheckout(record.id, existing.id);
      record = await this.applicants.findOwned(userId, accessRequestId);
    }
    if (record.status !== AccessRequestStatus.AGREEMENT_ACCEPTED) {
      throw new BadRequestException(
        'This request is not currently eligible for checkout.',
      );
    }
    const frontendUrl = this.frontendUrl();
    const session = await this.stripe.checkout.sessions.create(
      this.checkoutSessionParams(record, billingPeriod, {
        successUrl: `${frontendUrl}/activation?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${frontendUrl}/activation?checkout=cancelled`,
      }),
      {
        // updatedAt changes when an expired session is released, so a retry
        // after expiry gets a fresh session instead of Stripe's cached one.
        idempotencyKey: `bantai-checkout-${record.id}-${billingPeriod}-${record.updatedAt.getTime()}`,
      },
    );
    if (!session.id || !session.url) {
      throw new InternalServerErrorException(
        'Stripe returned an incomplete checkout session. Please try again.',
      );
    }
    await this.accessRequests.attachCheckoutSession(
      record.id,
      session.id,
      billingPeriod,
    );
    return { status: 'open' as const, url: session.url };
  }

  private checkoutSessionParams(
    record: { id: string; tier: AccessRequestTier; email: string },
    billingPeriod: BillingPeriod,
    urls: { successUrl: string; cancelUrl: string },
  ): Stripe.Checkout.SessionCreateParams {
    const metadata = {
      accessRequestId: record.id,
      tier: record.tier,
      billingPeriod,
    };
    return {
      mode: 'subscription',
      // The verified account email; Stripe uses it for the receipt.
      customer_email: record.email,
      line_items: [this.lineItemFor(record.tier, billingPeriod)],
      // The webhook finds the request from metadata, never from the URL.
      metadata,
      subscription_data: { metadata },
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      allow_promotion_codes: false,
    };
  }

  async createCheckoutSession(dto: CheckoutRequest) {
    const { record, tokenId } = await this.accessRequests.consumeApprovalToken(
      dto.token,
    );
    // Payment is only offered once the applicant has accepted the license
    // agreement (APPROVED → AGREEMENT_ACCEPTED happens in AccessRequestsService).
    if (record.status !== AccessRequestStatus.AGREEMENT_ACCEPTED) {
      await this.releaseTokenReservation(tokenId);
      throw new BadRequestException(
        'This request is not currently eligible for checkout.',
      );
    }
    if (record.legacyTier) {
      await this.releaseTokenReservation(tokenId);
      throw new BadRequestException(
        'This historical request requires contract review before a new checkout.',
      );
    }

    let attached = false;
    try {
      const lineItem = this.lineItemFor(record.tier, dto.billingPeriod);

      const frontendUrl = this.frontendUrl();
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          // Same email the applicant used on the request. Stripe uses it for the
          // receipt and matches it to a Customer record if one already exists.
          customer_email: record.email,
          line_items: [lineItem],
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
        },
        {
          // Retrying after a network failure returns the same Stripe session
          // instead of charging or creating checkout twice.
          idempotencyKey: `bantai-checkout-${record.id}-${dto.billingPeriod}`,
        },
      );

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
      attached = true;

      return { url: session.url };
    } finally {
      if (!attached) {
        await this.releaseTokenReservation(tokenId);
      }
    }
  }

  async reconcileTestCheckout(sessionId: string) {
    if (
      process.env.NODE_ENV === 'production' ||
      this.checkoutMode() !== 'test'
    ) {
      throw new ForbiddenException(
        'Test checkout reconciliation is not available.',
      );
    }
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.livemode) {
      throw new ForbiddenException(
        'Live Stripe sessions cannot use test reconciliation.',
      );
    }
    if (session.payment_status !== 'paid') {
      throw new BadRequestException(
        'Stripe has not confirmed payment for this test checkout.',
      );
    }
    const accessRequestId = session.metadata?.accessRequestId?.trim();
    if (!accessRequestId) {
      throw new BadRequestException(
        'The Stripe test checkout is missing its access request binding.',
      );
    }
    const result = await this.accessRequests.activateFromWebhook({
      checkoutSessionId: session.id,
      expectedAccessRequestId: accessRequestId,
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : null,
    });
    const active = result.activated || Boolean(result.accessRequestId);
    if (!active) {
      throw new BadRequestException(
        'This paid checkout is not eligible for portal activation.',
      );
    }
    if ('shieldReviewRequired' in result && result.shieldReviewRequired) {
      return {
        status: 'review_required' as const,
        message: 'Payment is recorded. Shield access requires contract review.',
      };
    }
    return {
      status: 'active' as const,
      message: result.activated
        ? 'Payment confirmed. Verify your email to create your portal account.'
        : 'Payment was already confirmed. Continue with account setup.',
      emailDelivery:
        'emailDelivery' in result ? result.emailDelivery : undefined,
    };
  }

  async reconcileAccessRequestPayment(accessRequestId: string) {
    const record =
      await this.accessRequests.getPaymentLifecycleRecord(accessRequestId);
    if (record.status === AccessRequestStatus.ACTIVE && record.license) {
      if (!record.license.shieldApprovedAt) {
        return {
          status: 'review_required' as const,
          message:
            'Payment is recorded. Shield access requires contract review.',
        };
      }
      return {
        status: 'active' as const,
        message: 'Payment was already confirmed and this license is active.',
      };
    }
    if (
      record.status !== AccessRequestStatus.PAYMENT_PENDING ||
      !record.stripeCheckoutSessionId
    ) {
      throw new BadRequestException(
        'This request does not have a pending Stripe checkout to reconcile.',
      );
    }
    return this.reconcileTestCheckout(record.stripeCheckoutSessionId);
  }

  async cancelAccessRequest(
    accessRequestId: string,
    adminUserId: string,
    reason: string,
  ) {
    const record =
      await this.accessRequests.getPaymentLifecycleRecord(accessRequestId);
    if (record.status === AccessRequestStatus.ACTIVE || record.license) {
      throw new ConflictException(
        'This request already has an active license. Suspend or revoke the portal account instead.',
      );
    }
    if (record.stripeCheckoutSessionId) {
      let session = await this.retrieveBoundSession(
        record.stripeCheckoutSessionId,
        accessRequestId,
      );
      if (session.payment_status === 'paid') {
        await this.activatePaidSession(session, accessRequestId);
        throw new ConflictException(
          'Stripe confirmed this payment. The request was activated instead of cancelled.',
        );
      }
      if (session.status === 'open') {
        try {
          session = await this.stripe.checkout.sessions.expire(session.id);
        } catch (error) {
          session = await this.retrieveBoundSession(
            session.id,
            accessRequestId,
          );
          if (session.payment_status === 'paid') {
            await this.activatePaidSession(session, accessRequestId);
            throw new ConflictException(
              'Stripe confirmed this payment while cancellation was in progress. The request was activated instead.',
            );
          }
          throw error;
        }
      }
    }
    return this.accessRequests.cancelUnpaid(
      accessRequestId,
      adminUserId,
      reason,
    );
  }

  async deleteAccessRequest(
    accessRequestId: string,
    adminUserId: string,
    reason: string,
  ) {
    const record =
      await this.accessRequests.getPaymentLifecycleRecord(accessRequestId);
    if (record.stripeCheckoutSessionId) {
      let session = await this.retrieveBoundSession(
        record.stripeCheckoutSessionId,
        accessRequestId,
      );
      if (session.payment_status === 'paid') {
        throw new ConflictException(
          'Stripe confirmed payment for this request, so it cannot be deleted.',
        );
      }
      if (session.status === 'open') {
        session = await this.stripe.checkout.sessions.expire(session.id);
        if (session.payment_status === 'paid') {
          throw new ConflictException(
            'Stripe confirmed payment while deletion was in progress, so this request cannot be deleted.',
          );
        }
      }
    }
    return this.accessRequests.deleteTerminal(
      accessRequestId,
      adminUserId,
      reason,
    );
  }

  private async retrieveBoundSession(
    checkoutSessionId: string,
    accessRequestId: string,
  ) {
    const session =
      await this.stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (session.metadata?.accessRequestId !== accessRequestId) {
      throw new BadRequestException(
        'The Stripe checkout does not match this access request.',
      );
    }
    return session;
  }

  private async activatePaidSession(
    session: Stripe.Checkout.Session,
    accessRequestId: string,
  ) {
    return this.accessRequests.activateFromWebhook({
      checkoutSessionId: session.id,
      expectedAccessRequestId: accessRequestId,
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : null,
    });
  }

  private async releaseTokenReservation(tokenId: string) {
    try {
      await this.accessRequests.releaseApprovalToken(tokenId);
    } catch (error) {
      this.logger.error(
        `Failed to release checkout token reservation ${tokenId}: ${(error as Error).message}`,
      );
    }
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_status !== 'paid') {
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
          stripeEventCreated: event.created,
        });
        return { received: true, activated: activated.activated };
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const currentPeriodEnd = (
          subscription as Stripe.Subscription & { current_period_end?: number }
        ).current_period_end;
        const validUntil = currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : null;
        let status = this.mapSubscriptionStatus(subscription.status);
        // Cancelling ends access at the end of the period already paid for,
        // not immediately; the validity window then expires the license.
        if (
          status === LicenseStatus.CANCELLED &&
          validUntil &&
          validUntil > new Date()
        ) {
          status = LicenseStatus.ACTIVE;
        }
        const updated = await this.accessRequests.updateSubscriptionFromWebhook(
          {
            stripeSubscriptionId: subscription.id,
            status,
            stripeEventCreated: event.created,
            validUntil,
          },
        );
        return { received: true, updated: updated.updated };
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subscriptionId) return { received: true };
        const updated = await this.accessRequests.updateSubscriptionFromWebhook(
          {
            stripeSubscriptionId: subscriptionId,
            status: LicenseStatus.PAST_DUE,
            stripeEventCreated: event.created,
          },
        );
        return { received: true, updated: updated.updated };
      }
      default:
        // Every other event is acknowledged but not acted on — Stripe expects
        // 2xx or it retries. Access mutation only happens on the events above.
        return { received: true };
    }
  }

  private mapSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): LicenseStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return LicenseStatus.ACTIVE;
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
        return LicenseStatus.PAST_DUE;
      case 'canceled':
        return LicenseStatus.CANCELLED;
      case 'paused':
        return LicenseStatus.SUSPENDED;
      case 'incomplete_expired':
        return LicenseStatus.EXPIRED;
      default:
        return LicenseStatus.SUSPENDED;
    }
  }

  private lineItemFor(tier: AccessRequestTier, period: BillingPeriod) {
    if (this.checkoutMode() === 'test') {
      return {
        price_data: {
          currency: 'php',
          unit_amount: TEST_PRICE_CENTAVOS[tier][period],
          recurring: {
            interval: period === BillingPeriod.MONTHLY ? 'month' : 'year',
          },
          product_data: {
            name: `BantAI Shield Subscription (${period === BillingPeriod.MONTHLY ? 'Monthly' : 'Annual'})`,
          },
        },
        quantity: 1,
      } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
    }

    const priceId = livePriceId(tier, period);
    if (!priceId) {
      throw new InternalServerErrorException(
        'This license and billing period is not configured for live Stripe checkout.',
      );
    }
    return {
      price: priceId,
      quantity: 1,
    } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
  }

  private checkoutMode(): 'test' | 'live' {
    const configured = process.env.STRIPE_CHECKOUT_MODE?.trim().toLowerCase();
    const mode =
      configured || (process.env.NODE_ENV === 'production' ? 'live' : 'test');
    if (mode !== 'test' && mode !== 'live') {
      throw new InternalServerErrorException(
        'STRIPE_CHECKOUT_MODE must be either test or live.',
      );
    }
    if (process.env.NODE_ENV === 'production' && mode !== 'live') {
      throw new InternalServerErrorException(
        'Stripe test checkout is disabled in production.',
      );
    }
    return mode;
  }

  private frontendUrl() {
    const url =
      process.env.FRONTEND_URL?.trim() ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    if (!url) {
      throw new InternalServerErrorException(
        'FRONTEND_URL is required to build Stripe redirect URLs.',
      );
    }
    return url.replace(/\/+$/, '');
  }
}
