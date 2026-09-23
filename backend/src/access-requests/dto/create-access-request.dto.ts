import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccessRequestTier } from '@prisma/client';

export class CreateAccessRequestDto {
  @IsEnum(AccessRequestTier)
  tier: AccessRequestTier;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organization: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  intendedUse: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}
