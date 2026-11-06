import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export const REVIEWED_LABELS = ['Ham', 'Spam'] as const;
export type ReviewedLabel = (typeof REVIEWED_LABELS)[number];

/*
 * Reject only: what the text really is, so the phone can move it to Messages
 * (Ham) or Spam after lifting the block its Scam report caused. A separate DTO
 * so Validate (where the user's label stands) rejects the field with a 400
 * instead of silently ignoring it.
 */
export class RejectReportDto extends ReviewReportDto {
  @IsOptional()
  @IsIn(REVIEWED_LABELS)
  reviewedLabel?: ReviewedLabel;
}
