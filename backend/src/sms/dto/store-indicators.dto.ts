import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const INDICATOR_TAGS = [
  'Prize Lure',
  'Urgency Cue',
  'Gambling Bait',
  'Fake Job Offer',
  'Unsolicited Credit Offer',
  'Personal Info Request',
  'OTP / Account Phishing',
  'Suspicious URL',
  'Brand Impersonation',
] as const;

class IndicatorDto {
  @IsIn(INDICATOR_TAGS)
  tag: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight: number;
}

export class StoreIndicatorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicatorDto)
  indicators: IndicatorDto[];
}
