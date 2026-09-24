import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

type EmailOtpPurpose = 'CLIENT_SIGN_IN' | 'CLIENT_CLAIM' | 'ADMIN_SIGN_IN';

@Injectable()
export class PortalOtpEmailService {
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

    const port = Number.parseInt(process.env.GMAIL_SMTP_PORT || '465', 10);
    this.transporter ??= nodemailer.createTransport({
      host: process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });

    const context =
      purpose === 'ADMIN_SIGN_IN'
        ? 'BantAI staff sign-in'
        : purpose === 'CLIENT_CLAIM'
          ? 'BantAI client account activation'
          : 'BantAI client sign-in';

    try {
      await this.transporter.sendMail({
        from: `BantAI <${from}>`,
        to,
        subject: `${code} is your BantAI verification code`,
        text: `Your verification code for ${context} is ${code}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
        html: `<p>Your verification code for ${context} is:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${code}</p><p>It expires in 5 minutes. If you did not request this code, you can ignore this email.</p>`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Email OTP delivery is temporarily unavailable.',
      );
    }
  }
}
