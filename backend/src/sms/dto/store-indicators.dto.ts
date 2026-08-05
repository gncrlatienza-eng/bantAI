import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class IndicatorDto {
  @IsString()
  tag: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight: number;
}

export class StoreIndicatorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicatorDto)
  indicators: IndicatorDto[];
}
