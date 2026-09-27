import { IsString, MaxLength, MinLength } from 'class-validator';

export class PortalRegisterDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  checkoutSessionId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
