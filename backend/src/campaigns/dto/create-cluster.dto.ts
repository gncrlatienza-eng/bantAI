import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Current campaign wording-profile contract shared with the AI service. */
export const CAMPAIGN_PROFILE_VERSION = 1;

/**
 * The wording a campaign's members hold in common, built offline by
 * ai/scripts/cluster_campaigns.py from masked text (audit 2026-09-30,
 * finding 5). Only word shingles present in at least half of a campaign's
 * members, so it is template phrasing rather than any one message. Shingles
 * that still look like an identifier (a URL, an address, a long number) are
 * refused outright.
 */
export class CampaignLexicalProfileDto {
  @Equals(CAMPAIGN_PROFILE_VERSION)
  version: number;

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  // Lowercase word unigrams/bigrams and <PLACEHOLDER> tokens only.
  @Matches(/^[a-z0-9<>]+(?: [a-z0-9<>]+)?$/, { each: true })
  // No 4+ digit run: a masked template never needs one.
  @Matches(/^(?!.*\d{4})/, { each: true })
  shingles: string[];

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  memberCount: number;
}

export class CreateClusterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  centroid?: unknown;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urlDomains?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignLexicalProfileDto)
  lexical?: CampaignLexicalProfileDto;
}
