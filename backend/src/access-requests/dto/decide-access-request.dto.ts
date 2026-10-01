import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeclineAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/* What the reviewer needs the applicant to clarify. Shown to the applicant,
   so it is required and bounded. */
export class RequestMoreInfoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message: string;
}
