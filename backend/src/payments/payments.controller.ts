import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentsService } from './payments.service';

/*
 * Public payments surface:
 *
 *   POST /api/payments/checkout-session — applicant, keyed by approval token
 *   POST /api/payments/webhook           — Stripe, verified by signature
 *
 * The webhook is the ONLY signal that grants access. main.ts is configured
 * so this route receives the raw body needed for signature verification.
 */

@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  // 10 checkout attempts per IP per minute — well above any legitimate flow,
  // low enough to blunt a scripted enumerator hammering approval tokens.
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('checkout-session')
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.svc.createCheckoutSession(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    // main.ts populates req.rawBody for this route via express raw parsing.
    const buffer = req.rawBody;
    if (!buffer) {
      // Absent raw body means the route was misconfigured; refuse rather
      // than fall back to a re-serialized body that will never validate.
      throw new Error(
        'Raw body missing on Stripe webhook route — check main.ts raw parser configuration.',
      );
    }
    return this.svc.handleWebhook(buffer, signature);
  }
}
