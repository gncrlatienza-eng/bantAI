import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AddOrganizationMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsIn(['TIER_1', 'TIER_2'])
  role: 'TIER_1' | 'TIER_2';
}
