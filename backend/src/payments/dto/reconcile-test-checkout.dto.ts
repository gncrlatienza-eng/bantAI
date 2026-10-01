import { IsString, Matches } from 'class-validator';

export class ReconcileTestCheckoutDto {
  @IsString()
  @Matches(/^cs_test_[A-Za-z0-9_]+$/, {
    message: 'checkoutSessionId must be a Stripe test Checkout Session id.',
  })
  checkoutSessionId!: string;
}
