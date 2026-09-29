import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClusterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  centroid?: unknown;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urlDomains?: string[];
}
