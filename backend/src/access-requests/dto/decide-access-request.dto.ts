import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeclineAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
