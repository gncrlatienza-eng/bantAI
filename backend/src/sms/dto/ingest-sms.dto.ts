import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestSmsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sender: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsDateString()
  receivedAt: string;
}
