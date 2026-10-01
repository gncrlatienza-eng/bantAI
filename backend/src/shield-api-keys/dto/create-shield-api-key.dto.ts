import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ShieldApiScope } from '@prisma/client';

export class CreateShieldApiKeyDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ShieldApiScope, { each: true })
  scopes: ShieldApiScope[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
