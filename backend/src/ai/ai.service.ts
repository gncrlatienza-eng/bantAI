import { Injectable, Logger } from '@nestjs/common';

type AiLabel = 'Ham' | 'Spam' | 'Scam';
type AiBucket = 'safe' | 'unknown' | 'spam' | 'blocked';

interface AiClassifyResponse {
  label: AiLabel;
  score: number;
  scores: Record<AiLabel, number>;
  bucket: AiBucket;
  masked_text: string;
}

export interface ClassificationResult {
  label: AiLabel;
  score: number;
  scores: Record<AiLabel, number>;
  bucket: AiBucket;
  maskedText: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8001';

  async classify(messageBody: string): Promise<ClassificationResult | null> {
    try {
      const res = await fetch(`${this.baseUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageBody }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 503) {
        this.logger.warn(
          'AI service model not ready (503) — will fall back to local heuristic',
        );
        return null;
      }

      if (!res.ok) {
        this.logger.error(
          `AI service returned unexpected status ${res.status}`,
        );
        return null;
      }

      const data: AiClassifyResponse = await res.json();

      return {
        label: data.label,
        score: data.score,
        scores: data.scores,
        bucket: data.bucket,
        maskedText: data.masked_text,
      };
    } catch (err) {
      this.logger.warn(
        `AI service unreachable: ${(err as Error).message} — will fall back to local heuristic`,
      );
      return null;
    }
  }
}
