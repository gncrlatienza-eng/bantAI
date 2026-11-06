import { AuditEventType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class AuditEventQueryDto {
  /** "true" also lists routine restricted-content reads. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeReads?: 'true' | 'false';

  /** Only events of this type (overrides includeReads). */
  @IsOptional()
  @IsEnum(AuditEventType)
  type?: AuditEventType;
}
