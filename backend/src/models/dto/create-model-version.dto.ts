import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModelVersionDto {
  @IsString()
  @MaxLength(64)
  versionTag: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  f1Score: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  accuracy?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  // Optional richer evidence from the training pipeline (per-class metrics,
  // holdout size, McNemar result, baseline). Stored as submitted for review.
  @IsObject()
  @IsOptional()
  evaluation?: Record<string, unknown>;

  // Optional provenance: dataset snapshot tag, run directory, artifact digest.
  @IsObject()
  @IsOptional()
  provenance?: Record<string, unknown>;
}
