import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AccessRequestTier } from '@prisma/client';

/*
 * Only what BantAI needs to evaluate a license request (DPA proportionality):
 * identity, affiliation, intended use and expected access scope. No phone
 * number, address, government ID or payment data is collected at this stage.
 */

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const ORGANIZATION_DATA_ACCESS = [
  'EXPORTS',
  'API',
  'EXPORTS_AND_API',
] as const;

export class OrganizationDetailsDto {
  @Transform(trim)
  @IsUrl(
    { require_protocol: false },
    { message: 'website must be a valid URL' },
  )
  @MaxLength(200)
  website: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  deployment: string;

  @IsIn(ORGANIZATION_DATA_ACCESS)
  dataAccess: (typeof ORGANIZATION_DATA_ACCESS)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  contactPerson?: string;
}

export class CreateAccessRequestDto {
  // Shield is the only external subscription product.
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
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

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  applicantRole: string;

  /* How BantAI intelligence will be used. */
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  intendedUse: string;

  /* The problem the Shield deployment addresses. */
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @IsInt()
  @Min(1)
  @Max(500)
  expectedUsers: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationDetailsDto)
  organizationDetails?: OrganizationDetailsDto;

  /* Required: the applicant confirms the submission is accurate and
     authorizes BantAI to use it to evaluate this request. */
  @Equals(true, {
    message: 'You must confirm the information is accurate to submit.',
  })
  accuracyConfirmed: boolean;

  /* Optional, never a condition of access. */
  @IsOptional()
  @IsBoolean()
  productUpdatesOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  pilotInterest?: boolean;
}
