import { IsString, MaxLength, MinLength } from 'class-validator';

export class FirebaseLoginDto {
  @IsString()
  @MinLength(100)
  @MaxLength(4096)
  idToken: string;
}
