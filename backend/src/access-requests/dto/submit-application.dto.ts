import { OmitType } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

import { CreateAccessRequestDto } from './create-access-request.dto';

/*
 * Signed-in application. The email is taken from the verified account and
 * is never accepted from the request body.
 */
export class SubmitApplicationDto extends OmitType(CreateAccessRequestDto, [
  'email',
] as const) {}

export class AcceptApplicationAgreementDto {
  @IsString()
  @MaxLength(40)
  agreementVersion: string;
}

export class StartApplicationCheckoutDto {
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingPeriod: 'MONTHLY' | 'ANNUAL';
}
