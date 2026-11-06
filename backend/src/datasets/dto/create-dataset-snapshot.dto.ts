import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDatasetSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  versionTag?: string;
}
