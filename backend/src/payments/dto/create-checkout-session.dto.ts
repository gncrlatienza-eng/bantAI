import { IsEnum, IsString, MinLength } from 'class-validator';
import { BillingPeriod } from '@prisma/client';

export class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;
}
