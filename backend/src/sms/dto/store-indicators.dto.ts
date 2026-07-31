import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

class IndicatorDto {
  @IsString()
  tag!: string;

  @IsNumber()
  weight!: number;
}

export class StoreIndicatorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicatorDto)
  indicators!: IndicatorDto[];
}
