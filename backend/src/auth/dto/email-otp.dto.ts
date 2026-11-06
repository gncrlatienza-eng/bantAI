import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestEmailOtpDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

/*
 * Portal password-gated OTP request. The password is validated server-side
 * before any code is issued; both must match a persisted account before the
 * user reaches the OTP step. Anti-enumeration: the response is generic and
 * identical whether the account exists, the password matched, or neither.
 */
export class RequestPortalEmailOtpDto extends RequestEmailOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

export class VerifyEmailOtpDto extends RequestEmailOtpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;
}

export class RequestClaimEmailOtpDto extends RequestEmailOtpDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  checkoutSessionId: string;
}

export class VerifyClaimEmailOtpDto extends RequestClaimEmailOtpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password: string;
}

/*
 * Account-first registration. The code proves control of the email before any
 * account exists; the password is only accepted together with that proof.
 */
export class VerifySignUpDto extends RequestEmailOtpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password: string;
}
