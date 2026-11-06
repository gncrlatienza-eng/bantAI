import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePortalOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
