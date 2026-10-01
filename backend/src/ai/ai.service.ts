import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

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

export interface ClassifyResult {
  label: 'Ham' | 'Spam' | 'Scam';
  score: number;
  bucket: 'safe' | 'unknown' | 'spam' | 'blocked';
  indicators: { tag: string; weight: number }[];
  explanationMethod: 'shap' | 'keyword-fallback';
  /** The campaign the AI matched this message to, or null when nothing cleared a tier. */
  campaign: { clusterId: string; matchReason: string | null } | null;
}

interface AiClassifyResponse {
  label: 'Ham' | 'Spam' | 'Scam';
  score: number;
  bucket: 'safe' | 'unknown' | 'spam' | 'blocked';
  indicators?: { tag?: unknown; weight?: unknown }[];
  explanation_method?: unknown;
  campaign?: {
    cluster_id?: unknown;
    matched?: unknown;
    match_reason?: unknown;
  } | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8001';
  private readonly apiKey = process.env.AI_SERVICE_API_KEY ?? '';

  /**
   * Shared header set for AI-service calls. The `x-api-key` header is only
   * included when configured — the AI service accepts unauthenticated calls
   * in local development (see BANTAI_AI_SERVICE_API_KEY in ai/service/config.py).
   */
  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    return headers;
  }

  /**
   * Classifies a privacy-masked SMS with the deployed ML service. Failure is
   * deliberately non-fatal to ingestion: the caller may show an inbox caution,
   * but must never turn a client fallback into an automatic block.
   */
  async classifyMasked(message: string): Promise<ClassifyResult | null> {
    try {
      const res = await fetch(`${this.baseUrl}/classify`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) {
        this.logger.warn(`AI service /classify returned ${res.status}`);
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- response is externally supplied
      const data: AiClassifyResponse = await res.json();
      if (
        !['Ham', 'Spam', 'Scam'].includes(data.label) ||
        !['safe', 'unknown', 'spam', 'blocked'].includes(data.bucket) ||
        typeof data.score !== 'number' ||
        !Number.isFinite(data.score) ||
        data.score < 0 ||
        data.score > 1
      ) {
        this.logger.warn('AI service /classify returned an invalid payload');
        return null;
      }
      const indicators = (data.indicators ?? []).filter(
        (indicator): indicator is { tag: string; weight: number } =>
          typeof indicator.tag === 'string' &&
          typeof indicator.weight === 'number' &&
          Number.isFinite(indicator.weight) &&
          indicator.weight >= 0 &&
          indicator.weight <= 1,
      );
      const explanationMethod =
        data.explanation_method === 'shap' ? 'shap' : 'keyword-fallback';
      // Only a positive match is kept. cluster_id is the backend's own
      // CampaignCluster id (the AI service loads centroids from
      // GET /campaigns/centroids), so the caller can look it up directly.
      const match = data.campaign;
      const campaign =
        match &&
        match.matched === true &&
        typeof match.cluster_id === 'string' &&
        match.cluster_id.length > 0 &&
        match.cluster_id.length <= 64
          ? {
              clusterId: match.cluster_id,
              matchReason:
                typeof match.match_reason === 'string'
                  ? match.match_reason
                  : null,
            }
          : null;
      return {
        label: data.label,
        score: data.score,
        bucket: data.bucket,
        indicators,
        explanationMethod,
        campaign,
      };
    } catch (err) {
      this.logger.warn(
        `AI service unreachable for /classify: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Proxies POST /summarize on the AI service (WBS 4.3.9/4.3.11). Unlike
   * there is no on-device fallback for a real extractive summary,
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
        headers: this.authHeaders(),
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- response is externally supplied
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
