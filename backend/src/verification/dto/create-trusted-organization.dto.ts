import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTrustedOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  // Accepted only for an administrator to establish a server-side HMAC key;
  // it is not persisted or returned by this API.
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  sender: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  officialDomains?: string[];

  @IsUrl({ require_tld: true, protocols: ['https'] })
  @MaxLength(2048)
  evidenceUrl: string;

  @IsIn(['government_registry', 'official_domain', 'manual_review'])
  evidenceType: 'government_registry' | 'official_domain' | 'manual_review';

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
