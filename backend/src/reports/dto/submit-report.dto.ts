import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const MAX_REPORT_NOTE_LENGTH = 500;

export class SubmitReportDto {
  @IsUUID()
  messageId: string;

  @IsIn(['Ham', 'Spam', 'Scam'])
  reportedLabel: string;

  // Free-text context from the reporter ("they called me first", etc.).
  // Privacy-masked server-side before storage, like the message body.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REPORT_NOTE_LENGTH)
  note?: string;
}
