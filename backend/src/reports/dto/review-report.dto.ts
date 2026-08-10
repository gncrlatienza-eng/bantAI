import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
