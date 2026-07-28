import { IsArray, IsString } from 'class-validator';

export class AddDomainsDto {
  @IsArray()
  @IsString({ each: true })
  domains: string[];
}
