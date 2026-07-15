import { Injectable } from '@nestjs/common';

export interface ClassificationResult {
  label: 'Likely Smishing' | 'Suspicious' | 'Unknown';
  score: number;
}

@Injectable()
export class AiService {
  // Stub — real XLM-RoBERTa call comes later, once ai-service exists.
  async classify(messageBody: string): Promise<ClassificationResult> {
    return { label: 'Suspicious', score: 0.75 };
  }
}