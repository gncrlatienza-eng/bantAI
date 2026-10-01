import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSafetyTipDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaign?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
