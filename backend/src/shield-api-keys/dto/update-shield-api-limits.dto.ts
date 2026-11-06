import { IsInt, Max, Min } from 'class-validator';

export class UpdateShieldApiLimitsDto {
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  monthlyQuota: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMinute: number;
}
