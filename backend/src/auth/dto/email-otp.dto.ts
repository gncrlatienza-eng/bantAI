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
}
