import {
  IsNumber,
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
}
