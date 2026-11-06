import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CampaignEvidenceDto {
  @IsString()
  @MinLength(15)
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^(report|operation):[0-9a-f-]{36}$/i, { each: true })
  evidenceReferences!: string[];
}

export class MergeCampaignsDto extends CampaignEvidenceDto {
  @IsUUID()
  sourceId!: string;

  @IsInt()
  @Min(0)
  expectedSourceRevision!: number;

  @IsInt()
  @Min(0)
  expectedTargetRevision!: number;
}

export class SplitCampaignDto extends CampaignEvidenceDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsUUID(undefined, { each: true })
  messageIds!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  domains!: string[];
}

export class CorrectAssignmentDto extends CampaignEvidenceDto {
  @IsUUID()
  messageId!: string;

  @IsOptional()
  @IsUUID()
  targetCampaignId?: string;
}

export class DraftEvolutionDto {
  @IsIn([
    'INDICATOR_SHIFT',
    'TACTIC_CHANGE',
    'CAMPAIGN_RELATION',
    'STATUS_CHANGE',
  ])
  type!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(500)
  summary!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^(report|operation|observation):[0-9a-f-]{36}$/i, { each: true })
  evidenceReferences!: string[];
}
