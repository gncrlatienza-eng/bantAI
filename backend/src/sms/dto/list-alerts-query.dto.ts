import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Keyset paging for GET /sms/alerts. With no query the response is the same
// newest-100 array older clients already expect; `before` (the createdAt of
// the last alert on the previous page) fetches the next, older page.
export class ListAlertsQueryDto {
  @IsOptional()
  @IsDateString()
  before?: string;

  // Tie-breaker for alerts sharing the `before` millisecond: the id of the
  // last alert on the previous page.
  @IsOptional()
  @IsUUID()
  beforeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;
}
