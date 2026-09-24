import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class VerifyOtpDto {
  @ValidateIf((o: VerifyOtpDto) => !o.email || Boolean(o.phone))
  @IsPhoneNumber('PH', {
    message:
      'phone must be a valid Philippine mobile number when email is not provided',
  })
  phone?: string;

  @ValidateIf((o: VerifyOtpDto) => !o.phone || Boolean(o.email))
  @IsEmail(
    {},
    {
      message: 'email must be a valid email address when phone is not provided',
    },
  )
  email?: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit number' })
  otp: string;
}
