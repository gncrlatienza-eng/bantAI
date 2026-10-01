/** Language tags reviewers can assign. "mixed" covers code-switched Taglish. */
export const DATASET_LANGUAGES = ['en', 'fil', 'mixed', 'other'] as const;
export type DatasetLanguage = (typeof DATASET_LANGUAGES)[number];
