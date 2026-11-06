import { IsString, MaxLength, MinLength } from 'class-validator';

export class PortalAccountActionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
