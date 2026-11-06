import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewSenderReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reportId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
