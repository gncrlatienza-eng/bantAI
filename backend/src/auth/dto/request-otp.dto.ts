import { IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @IsPhoneNumber('PH')
  phone: string;
}