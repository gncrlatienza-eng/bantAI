import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateClusterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  centroid?: unknown;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urlDomains?: string[];
}
