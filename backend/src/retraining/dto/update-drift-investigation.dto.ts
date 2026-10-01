import { DriftInvestigationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDriftInvestigationDto {
  @IsOptional()
  @IsEnum(DriftInvestigationStatus)
  status?: DriftInvestigationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Required when resolving or dismissing: what was found and why.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}
