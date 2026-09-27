import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailOtpPurpose } from '@prisma/client';

@Injectable()
export class PortalOtpEmailService {
  private readonly logger = new Logger(PortalOtpEmailService.name);
  private transporter?: Transporter;

  async send(to: string, code: string, purpose: EmailOtpPurpose) {
    const user = process.env.GMAIL_SMTP_USER?.trim();
    const password = process.env.GMAIL_SMTP_APP_PASSWORD?.trim();
    const from = process.env.PORTAL_FROM_EMAIL?.trim() || user;
    if (!user || !password || !from) {
      throw new ServiceUnavailableException(
        'Email OTP delivery is not configured.',
      );
    }

    const host = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number.parseInt(process.env.GMAIL_SMTP_PORT || '465', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException(
        'Email OTP delivery is not configured.',
      );
    }
    this.transporter ??= nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: {
        minVersion: 'TLSv1.2',
        servername: host,
        rejectUnauthorized: true,
      },
    });

    const context =
      purpose === 'ADMIN_SIGN_IN'
        ? 'BantAI staff sign-in'
        : purpose === 'CLIENT_CLAIM'
          ? 'BantAI client account activation'
          : purpose === 'MOBILE_SIGN_IN'
            ? 'BantAI mobile sign-in'
            : 'BantAI client sign-in';

    try {
      await this.transporter.sendMail({
        from: `BantAI <${from}>`,
        to,
        // Keep the OTP out of lock-screen notification previews.
        subject: 'Your BantAI verification code',
        text: `Your verification code for ${context} is ${code}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
        html: `<p>Your verification code for ${context} is:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${code}</p><p>It expires in 5 minutes. If you did not request this code, you can ignore this email.</p>`,
      });
    } catch (error) {
      const smtpError = error as {
        name?: string;
        code?: string;
        responseCode?: number;
        command?: string;
      };
      this.logger.warn(
        `Gmail SMTP OTP delivery failed (name=${smtpError.name || 'unknown'}, code=${smtpError.code || 'unknown'}, responseCode=${smtpError.responseCode || 'unknown'}, command=${smtpError.command || 'unknown'})`,
      );
      throw new ServiceUnavailableException(
        'Email OTP delivery is temporarily unavailable.',
      );
    }
  }
}
