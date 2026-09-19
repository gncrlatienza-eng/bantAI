import { Injectable, Logger } from '@nestjs/common';

import { normalizePhilippineMobile } from '../auth/phone';

export interface SenderReputationResult {
  status: 'fraud' | 'unknown';
  source: 'ipqs-phone-reputation';
  expiresAt: Date;
}

interface IpqsPhoneResponse {
  success?: boolean;
  fraud_score?: number;
  recent_abuse?: boolean | null;
}

/**
 * Server-only adapter for the selected external reputation source. It accepts
 * only canonical Philippine mobile numbers, sends no SMS content or account
 * identity, and deliberately persists only the resulting risk class.
 */
@Injectable()
export class SenderReputationService {
  private readonly logger = new Logger(SenderReputationService.name);

  async lookup(sender: string): Promise<SenderReputationResult | null> {
    const apiKey = process.env.IPQS_API_KEY;
    const phone = normalizePhilippineMobile(sender);
    if (!apiKey || !phone) return null;

    try {
      const url = new URL('https://ipqualityscore.com/api/json/phone');
      url.searchParams.set('phone', phone);
      url.searchParams.set('strictness', '1');
      const response = await fetch(url, {
        headers: { 'IPQS-KEY': apiKey },
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) {
        this.logger.warn(`IPQS lookup returned ${response.status}`);
        return null;
      }
      const data = (await response.json()) as IpqsPhoneResponse;
      if (
        !data.success ||
        typeof data.fraud_score !== 'number' ||
        !Number.isFinite(data.fraud_score)
      ) {
        return null;
      }

      // IPQS documents scores >=90 and recent abuse as high-risk. This result
      // opens a user-reviewable alert; it never blocks a number on its own.
      const highRisk = data.recent_abuse === true || data.fraud_score >= 90;
      return {
        status: highRisk ? 'fraud' : 'unknown',
        source: 'ipqs-phone-reputation',
        expiresAt: new Date(
          Date.now() + (highRisk ? 30 : 1) * 24 * 60 * 60 * 1000,
        ),
      };
    } catch (error) {
      this.logger.warn(`IPQS lookup unavailable: ${(error as Error).message}`);
      return null;
    }
  }
}
