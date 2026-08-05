import { IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber('PH')
  phone: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit number' })
  otp: string;
}
