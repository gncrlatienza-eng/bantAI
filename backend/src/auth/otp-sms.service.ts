import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Delivers OTP codes via Semaphore PH SMS gateway.
 * Requires SEMAPHORE_API_KEY in the environment. Delivery failures are surfaced
 * to callers; a code that was not delivered must not be left valid.
 */
@Injectable()
export class OtpSmsService {
  private readonly logger = new Logger(OtpSmsService.name);

  async send(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.SEMAPHORE_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('OTP delivery is not configured.');
    }

    try {
      const res = await fetch('https://api.semaphore.co/api/v4/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          number: phone,
          message: `Your BantAI verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
          sendername: 'BANTAI',
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        // Do not log provider response bodies: they can echo recipient/message data.
        this.logger.error(
          `Semaphore SMS delivery failed (HTTP ${res.status}).`,
        );
        throw new ServiceUnavailableException('OTP delivery failed.');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Semaphore SMS delivery request failed.');
      throw new ServiceUnavailableException('OTP delivery failed.');
    }
  }
}
