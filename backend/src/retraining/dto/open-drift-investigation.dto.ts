import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenDriftInvestigationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
