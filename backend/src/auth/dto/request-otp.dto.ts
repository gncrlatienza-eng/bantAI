import { IsEmail, IsPhoneNumber, ValidateIf } from 'class-validator';

export class RequestOtpDto {
  @ValidateIf((o: RequestOtpDto) => !o.email || Boolean(o.phone))
  @IsPhoneNumber('PH', {
    message:
      'phone must be a valid Philippine mobile number when email is not provided',
  })
  phone?: string;

  @ValidateIf((o: RequestOtpDto) => !o.phone || Boolean(o.email))
  @IsEmail(
    {},
    {
      message: 'email must be a valid email address when phone is not provided',
    },
  )
  email?: string;
}
