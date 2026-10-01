import { IsIn, IsOptional } from 'class-validator';

import { DATASET_LANGUAGES, type DatasetLanguage } from './dataset-language';

export class CurateReportDto {
  @IsOptional()
  @IsIn(['Ham', 'Spam', 'Scam'])
  label?: 'Ham' | 'Spam' | 'Scam';

  @IsOptional()
  @IsIn(DATASET_LANGUAGES)
  language?: DatasetLanguage;
}
