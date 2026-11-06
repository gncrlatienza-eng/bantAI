import { IsBoolean, IsIn, IsOptional, ValidateIf } from 'class-validator';

import { DATASET_LANGUAGES, type DatasetLanguage } from './dataset-language';

export class UpdateDatasetSampleDto {
  @IsOptional()
  @IsIn(['Ham', 'Spam', 'Scam'])
  label?: 'Ham' | 'Spam' | 'Scam';

  // null clears a language tag that was set in error.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsIn(DATASET_LANGUAGES)
  language?: DatasetLanguage | null;

  @IsOptional()
  @IsBoolean()
  included?: boolean;
}
