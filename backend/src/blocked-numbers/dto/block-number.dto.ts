import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BlockNumberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sender: string;
}
