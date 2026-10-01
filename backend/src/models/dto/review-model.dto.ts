import { IsString, MaxLength, MinLength } from 'class-validator';

/** Every lifecycle decision records why it was made. */
export class ReviewModelDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  note: string;
}
