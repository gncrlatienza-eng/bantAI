import { Injectable, Logger } from '@nestjs/common';

/**
 * Delivers OTP codes via Semaphore PH SMS gateway.
 * Requires SEMAPHORE_API_KEY in the environment; logs a warning and no-ops in
 * dev when the key is absent so local testing still works without a provider.
 */
@Injectable()
export class OtpSmsService {
  private readonly logger = new Logger(OtpSmsService.name);

  async send(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.SEMAPHORE_API_KEY;
    if (!apiKey) {
      // Dev-only branch (no real SMS provider configured) -- printing the code
      // here is the whole point of the fallback, otherwise a tester has no way
      // to get it at all short of querying the OtpCode table directly.
      this.logger.warn(
        `SEMAPHORE_API_KEY not set — OTP not delivered via SMS (dev mode). Code for ${phone}: ${otp}`,
      );
      return;
    }

    const res = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        number: phone,
        message: `Your BantAI verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        sendername: 'BANTAI',
      }),
    });

    if (!res.ok) {
      this.logger.error(
        `Semaphore SMS delivery failed (${res.status}): ${await res.text()}`,
      );
    }
  }
}
