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
  // Full softmax from the AI service; null when absent or malformed.
  scores?: Record<'Ham' | 'Spam' | 'Scam', number> | null;
  bucket: 'safe' | 'unknown' | 'spam' | 'blocked';
  indicators: { tag: string; weight: number }[];
  explanationMethod: 'shap' | 'keyword-fallback';
  campaign: CampaignMatchResult | null;
}

export interface CampaignMatchResult {
  clusterId: string | null;
  similarity: number;
  matched: boolean;
  shouldBuffer: boolean;
  lexicalSimilarity: number;
  matchReason: 'domain' | 'hybrid' | 'embedding' | null;
}

interface AiClassifyResponse {
  label: 'Ham' | 'Spam' | 'Scam';
  score: number;
  scores?: unknown;
  bucket: 'safe' | 'unknown' | 'spam' | 'blocked';
  indicators?: { tag?: unknown; weight?: unknown }[];
  explanation_method?: unknown;
  campaign?: unknown;
}

const CAMPAIGN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The service's full softmax ({ Ham, Spam, Scam }). Anything malformed is
// dropped rather than stored, since Classification.scores feeds analytics.
function validatedScores(
  value: unknown,
): Record<'Ham' | 'Spam' | 'Scam', number> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const out = {} as Record<'Ham' | 'Spam' | 'Scam', number>;
  for (const key of ['Ham', 'Spam', 'Scam'] as const) {
    const v = raw[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      return null;
    }
    out[key] = v;
  }
  return out;
}

function validatedCampaign(value: unknown): CampaignMatchResult | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const campaign = value as Record<string, unknown>;
  const clusterId = campaign.cluster_id;
  const similarity = campaign.similarity;
  const matched = campaign.matched;
  const shouldBuffer = campaign.should_buffer;
  const lexicalSimilarity = campaign.lexical_similarity;
  const matchReason = campaign.match_reason;

  if (
    !(
      clusterId === null ||
      (typeof clusterId === 'string' && CAMPAIGN_ID_PATTERN.test(clusterId))
    ) ||
    typeof similarity !== 'number' ||
    !Number.isFinite(similarity) ||
    similarity < -1 ||
    similarity > 1 ||
    typeof matched !== 'boolean' ||
    typeof shouldBuffer !== 'boolean' ||
    typeof lexicalSimilarity !== 'number' ||
    !Number.isFinite(lexicalSimilarity) ||
    lexicalSimilarity < 0 ||
    lexicalSimilarity > 1 ||
    !(
      matchReason === null ||
      matchReason === 'domain' ||
      matchReason === 'hybrid' ||
      matchReason === 'embedding'
    )
  ) {
    return null;
  }

  if (
    (matched &&
      (clusterId === null || matchReason === null || shouldBuffer !== false)) ||
    (!matched &&
      (clusterId !== null || matchReason !== null || shouldBuffer !== true))
  ) {
    return null;
  }

  return {
    clusterId,
    similarity,
    matched,
    shouldBuffer,
    lexicalSimilarity,
    matchReason,
  };
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
  async classifyMasked(
    message: string,
    domains: string[] = [],
  ): Promise<ClassifyResult | null> {
    try {
      const res = await fetch(`${this.baseUrl}/classify`, {
        method: 'POST',
        headers: this.authHeaders(),
        // Masking replaces every link with [URL], so the hostnames the phone
        // extracted travel separately; they drive the matcher's domain tier
        // (audit 2026-09-30, finding 5). Hostnames only, never full URLs.
        body: JSON.stringify({ message, domains }),
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
      const campaign = validatedCampaign(data.campaign);
      if (data.campaign != null && campaign === null) {
        this.logger.warn(
          'AI service /classify returned invalid campaign metadata; ignoring campaign match',
        );
      }
      return {
        label: data.label,
        score: data.score,
        scores: validatedScores(data.scores),
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
