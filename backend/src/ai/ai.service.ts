import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

type AiLabel = 'Ham' | 'Spam' | 'Scam';
type AiBucket = 'safe' | 'unknown' | 'spam' | 'blocked';

interface AiSummarizeResponse {
  summary: string;
  sentence_count: number;
  source_message_count: number;
  truncated: boolean;
}

export interface SummarizeResult {
  summary: string;
  sentenceCount: number;
  sourceMessageCount: number;
  truncated: boolean;
}

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

      // fetch()'s Response.json() is typed Promise<any> by the DOM lib itself --
      // there's no runtime schema check on the AI service's response, so this
      // annotation is trusted, not verified.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

  /**
   * Proxies POST /summarize on the AI service (WBS 4.3.9/4.3.11). Unlike
   * classify(), there is no on-device fallback for a real extractive summary,
   * so an unreachable AI service surfaces as a 503 rather than a null the
   * caller might mistake for "no summary needed".
   */
  async summarize(
    messages: string[],
    maxSentences?: number,
  ): Promise<SummarizeResult> {
    try {
      const res = await fetch(`${this.baseUrl}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          ...(maxSentences ? { max_sentences: maxSentences } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        this.logger.error(
          `AI service /summarize returned unexpected status ${res.status}`,
        );
        throw new ServiceUnavailableException(
          'AI summarization is temporarily unavailable.',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- see classify() above
      const data: AiSummarizeResponse = await res.json();
      return {
        summary: data.summary,
        sentenceCount: data.sentence_count,
        sourceMessageCount: data.source_message_count,
        truncated: data.truncated,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `AI service unreachable for /summarize: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'AI summarization is temporarily unavailable.',
      );
    }
  }
}
