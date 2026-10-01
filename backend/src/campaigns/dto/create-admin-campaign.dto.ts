import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAdminCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  summary: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  mitigation: string;
}
