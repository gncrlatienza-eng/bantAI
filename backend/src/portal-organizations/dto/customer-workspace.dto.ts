import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsIn(['TIER_1', 'TIER_2'], {
    message: 'Role must be either TIER_1 or TIER_2.',
  })
  role: 'TIER_1' | 'TIER_2';
}

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty({ message: 'Target user ID is required.' })
  targetUserId: string;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required.' })
  token: string;
}
