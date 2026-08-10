import { IsIn, IsUUID } from 'class-validator';

export class SubmitReportDto {
  @IsUUID()
  messageId: string;

  @IsIn(['Ham', 'Spam', 'Scam'])
  reportedLabel: string;
}
