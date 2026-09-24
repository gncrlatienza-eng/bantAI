import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Delivers MFA verification OTP codes to staff Gmail/email addresses.
 * Fails closed if delivery cannot be completed.
 */
@Injectable()
export class OtpEmailService {
  private readonly logger = new Logger(OtpEmailService.name);

  async send(email: string, otp: string): Promise<void> {
    const serviceUrl = process.env.STAFF_MFA_EMAIL_SERVICE_URL;
    const apiKey = process.env.STAFF_MFA_EMAIL_API_KEY;

    // In non-production environments when no external email gateway is configured,
    // log dispatch for local developer authentication without leaking full email to logs.
    if (process.env.NODE_ENV !== 'production' && !serviceUrl && !apiKey) {
      this.logger.log(
        `[Staff MFA] Dispatched OTP code to ${this.redactEmail(email)}: ${otp}`,
      );
      return;
    }

    if (!serviceUrl && !apiKey) {
      throw new ServiceUnavailableException(
        'Staff email OTP delivery service is not configured.',
      );
    }

    try {
      const targetUrl = serviceUrl || 'https://api.resend.com/emails';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: email,
          subject: 'BantAI Staff MFA Verification Code',
          text: `Your BantAI staff verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.error(
          `Staff MFA email delivery failed (HTTP ${res.status}).`,
        );
        throw new ServiceUnavailableException('OTP delivery failed.');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Staff MFA email delivery request failed.');
      throw new ServiceUnavailableException('OTP delivery failed.');
    }
  }

  private redactEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [name, domain] = parts;
    const maskedName =
      name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
  }
}
