import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  IsEmail,
} from 'class-validator';

export class RegisterDto {
  @IsPhoneNumber('PH')
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}