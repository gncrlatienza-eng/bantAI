import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveAccessTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token: string;
}
