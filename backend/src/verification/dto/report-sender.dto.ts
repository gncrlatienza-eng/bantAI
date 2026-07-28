import { IsString, MaxLength } from 'class-validator';

export class ReportSenderDto {
  @IsString()
  @MaxLength(64)
  sender: string;
}
