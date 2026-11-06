import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveAccessTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token: string;
}

/* Accepting the license agreement pins the exact terms version the
   applicant saw, so a stale page cannot accept newer terms unseen. */
export class AcceptAgreementDto extends ResolveAccessTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  agreementVersion: string;
}
