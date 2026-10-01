import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AddOrganizationMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsIn(['SHIELD'])
  role: 'SHIELD';
}
