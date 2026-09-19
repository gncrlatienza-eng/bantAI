import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class IngestSmsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sender: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1600)
  maskedBody: string;

  // Device-local SMS row id. Retried deliveries use the same value.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sourceId: string;

  // A device fallback used only when the AI service is unavailable. These
  // values are never authoritative enough to trigger an automatic block.
  @IsOptional()
  @IsIn(['Ham', 'Spam', 'Scam'])
  label?: 'Ham' | 'Spam' | 'Scam';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  score?: number;

  @IsOptional()
  @IsIn(['safe', 'unknown', 'spam', 'blocked'])
  bucket?: 'safe' | 'unknown' | 'spam' | 'blocked';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  domains?: string[];

  @IsDateString()
  receivedAt: string;
}
