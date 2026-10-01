import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ShieldReviewDecision } from '@prisma/client';

export class ReviewLegacyLicenseDto {
  @IsEnum(ShieldReviewDecision)
  decision!: ShieldReviewDecision;

  @IsString()
  @MinLength(15)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(120)
  evidenceReference!: string;
}
