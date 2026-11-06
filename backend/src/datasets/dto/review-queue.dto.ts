import { IsIn, IsOptional } from 'class-validator';

import { DATASET_LANGUAGES, type DatasetLanguage } from './dataset-language';

/*
 * Detection review queue: messages the model classified on its own, from users
 * who opted in to training, shown to an admin to label. Nothing enters the
 * dataset without that review -- training on the model's own predictions
 * would turn its confident mistakes into "correct" examples.
 *
 *   detected    model said Scam (one per campaign / identical masked text)
 *   uncertain   model was not confident (bucket "unknown")
 *   spot_check  random sample of messages the model called safe -- where
 *               confident misses hide, since nobody reports a scam they missed
 */
export const REVIEW_KINDS = ['detected', 'uncertain', 'spot_check'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export class ReviewQueueQueryDto {
  @IsIn(REVIEW_KINDS)
  kind!: ReviewKind;
}

export class ConfirmCandidateDto {
  @IsIn(['Ham', 'Spam', 'Scam'])
  label!: 'Ham' | 'Spam' | 'Scam';

  @IsOptional()
  @IsIn(DATASET_LANGUAGES)
  language?: DatasetLanguage;
}
