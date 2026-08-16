import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SummarizeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(1600, { each: true })
  messages: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSentences?: number;
}
