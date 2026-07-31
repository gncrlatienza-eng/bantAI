<<<<<<< HEAD
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

class IndicatorDto {
  @IsString()
  tag!: string;

  @IsNumber()
  weight!: number;
=======
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class IndicatorItemDto {
  @IsString()
  tag: string;

  @IsNumber()
  weight: number;
>>>>>>> dda6d2538c81c33b2fa8ccca141fd77460c84618
}

export class StoreIndicatorsDto {
  @IsArray()
  @ValidateNested({ each: true })
<<<<<<< HEAD
  @Type(() => IndicatorDto)
  indicators!: IndicatorDto[];
=======
  @Type(() => IndicatorItemDto)
  indicators: IndicatorItemDto[];
>>>>>>> dda6d2538c81c33b2fa8ccca141fd77460c84618
}
