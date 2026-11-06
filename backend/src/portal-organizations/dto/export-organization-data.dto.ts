import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ExportOrganizationDataDto {
  @IsOptional()
  @IsIn(['json', 'csv'])
  format: 'json' | 'csv' = 'json';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  limit = 1_000;
}
