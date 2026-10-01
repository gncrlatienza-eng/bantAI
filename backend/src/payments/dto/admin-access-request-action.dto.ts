import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminAccessRequestActionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
