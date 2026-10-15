import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/*
 * Display-name fields only. The sign-in email is deliberately NOT editable
 * here: a generic profile write let any valid session silently re-point the
 * account's login identity to another inbox, with no re-authentication or
 * new-inbox verification (audit AUTH-02, 2026-10-13), and stored it without
 * the lowercase/trim normalization sign-in uses (AUTH-03). The global
 * ValidationPipe runs with forbidNonWhitelisted, so a body that still sends
 * `email` is rejected with 400 instead of being silently ignored. A real
 * email-change flow must be a dedicated, verified endpoint.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  /**
   * Opt in/out of letting the team review this user's flagged, masked
   * messages as training candidates (Privacy & data on the phone).
   */
  @IsOptional()
  @IsBoolean()
  trainingOptIn?: boolean;
}
