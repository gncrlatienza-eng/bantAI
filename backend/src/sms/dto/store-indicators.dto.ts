import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class IndicatorItemDto {
  @IsString()
  tag: string;

  @IsNumber()
  weight: number;
}

export class StoreIndicatorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicatorItemDto)
  indicators: IndicatorItemDto[];
}
