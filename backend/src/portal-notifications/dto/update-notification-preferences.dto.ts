import { IsBoolean, IsOptional } from 'class-validator';

/** Delivery settings are explicit opt-ins. In-app delivery remains available
 * for real events; this endpoint never sends SMS or exposes SMS content.
 *
 * Only settings with a working delivery path are accepted. Email delivery and
 * export-ready notices do not exist yet, so `emailEnabled` and
 * `exportUpdatesEnabled` are rejected (the global whitelist refuses unknown
 * fields) rather than stored as promises nothing keeps (audit 2026-09-30,
 * finding 8). Add them back together with their delivery implementation. */
export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() campaignChangesEnabled?: boolean;
  @IsOptional() @IsBoolean() subscriptionUpdatesEnabled?: boolean;
  @IsOptional() @IsBoolean() apiUsageAlertsEnabled?: boolean;
  @IsOptional() @IsBoolean() systemHealthAlertsEnabled?: boolean;
}
