import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ContactItemDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class SyncContactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contacts: ContactItemDto[];
}
