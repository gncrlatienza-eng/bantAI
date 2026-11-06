import { IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @IsPhoneNumber('PH', {
    message: 'phone must be a valid Philippine mobile number',
  })
  phone: string;
}
