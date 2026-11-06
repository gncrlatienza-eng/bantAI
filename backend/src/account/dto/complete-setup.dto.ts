import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CompleteSetupDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  /* Applicant organization or affiliation. */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organization: string;

  /* Echo of the account terms version shown; a mismatch means a stale page. */
  @IsString()
  @MaxLength(40)
  acceptedTermsVersion: string;
}
