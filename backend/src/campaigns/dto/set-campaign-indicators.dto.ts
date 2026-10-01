import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetCampaignIndicatorsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  @Matches(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i, { each: true })
  domains: string[];
}
