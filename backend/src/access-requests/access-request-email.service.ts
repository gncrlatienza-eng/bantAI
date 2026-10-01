import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AccessRequestTier } from '@prisma/client';

interface SubmissionReceipt {
  to: string;
  fullName: string;
  reference: string;
  tier: AccessRequestTier;
  reviewWindowBusinessDays: { min: number; max: number };
}

interface ApprovalNotice {
  to: string;
  fullName: string;
  reference: string;
  tier: AccessRequestTier;
  approvalUrl: string;
  expiresAt: Date;
}

interface ActivationNotice {
  to: string;
  fullName: string;
  reference: string;
  tier: AccessRequestTier;
  /** Sign-in (account holders) or sign-up (legacy requests without one). */
  continueUrl: string;
}

export class AccessRequestEmailDeliveryError extends Error {
  constructor(
    public readonly deliveryCode: string,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = 'AccessRequestEmailDeliveryError';
  }
}

export function sanitizedEmailDeliveryCode(error: unknown) {
  if (error instanceof AccessRequestEmailDeliveryError) {
    return error.deliveryCode;
  }
  return 'DELIVERY_FAILED';
}

@Injectable()
export class AccessRequestEmailService {
  private readonly logger = new Logger(AccessRequestEmailService.name);
  private transporter?: Transporter;

  async sendSubmissionReceipt(message: SubmissionReceipt) {
    const tier = this.tierName(message.tier);
    const name = message.fullName.trim();
    const { min, max } = message.reviewWindowBusinessDays;
    await this.send({
      to: message.to,
      subject: `BantAI access request received - ${message.reference}`,
      text: [
        `Hello ${name},`,
        '',
        `Your BantAI ${tier} access request went through successfully.`,
        `Reference: ${message.reference}`,
        `Typical review time: ${min}-${max} business days.`,
        '',
        'We will email this address again when a decision is available. No payment has been requested.',
      ].join('\n'),
      html: `<p>Hello ${this.escapeHtml(name)},</p><p>Your BantAI <strong>${tier}</strong> access request went through successfully.</p><p><strong>Reference:</strong> ${this.escapeHtml(message.reference)}<br><strong>Typical review time:</strong> ${min}-${max} business days</p><p>We will email this address again when a decision is available. No payment has been requested.</p>`,
    });
  }

  async sendApproval(message: ApprovalNotice) {
    const tier = this.tierName(message.tier);
    const name = message.fullName.trim();
    await this.send({
      to: message.to,
      subject: `Your BantAI access request was approved - ${message.reference}`,
      text: [
        `Hello ${name},`,
        '',
        `Your BantAI ${tier} access request (${message.reference}) was approved.`,
        'Sign in to your BantAI account to review and accept the license terms, then continue to payment:',
        message.approvalUrl,
        '',
        'Access starts only after payment is confirmed. BantAI staff will never ask for your password or verification codes.',
      ].join('\n'),
      html: `<p>Hello ${this.escapeHtml(name)},</p><p>Your BantAI <strong>${tier}</strong> access request (${this.escapeHtml(message.reference)}) was approved.</p><p>Sign in to your BantAI account to review and accept the license terms, then continue to payment:</p><p><a href="${this.escapeHtml(message.approvalUrl)}">Continue activation</a></p><p>Access starts only after payment is confirmed. BantAI staff will never ask for your password or verification codes.</p>`,
    });
  }

  async sendActivation(message: ActivationNotice) {
    const tier = this.tierName(message.tier);
    const name = message.fullName.trim();
    await this.send({
      to: message.to,
      subject: `BantAI payment confirmed - ${message.reference}`,
      text: [
        `Hello ${name},`,
        '',
        `Payment for your BantAI ${tier} (${message.reference}) was confirmed.`,
        'Your licensed access is active. Sign in to BantAI to open your workspace:',
        message.continueUrl,
        '',
        'BantAI staff will never ask for your password or verification codes.',
      ].join('\n'),
      html: `<p>Hello ${this.escapeHtml(name)},</p><p>Payment for your BantAI <strong>${tier}</strong> (${this.escapeHtml(message.reference)}) was confirmed.</p><p>Your licensed access is active. Sign in to BantAI to open your workspace:</p><p><a href="${this.escapeHtml(message.continueUrl)}">Open BantAI</a></p><p>BantAI staff will never ask for your password or verification codes.</p>`,
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    const user = process.env.GMAIL_SMTP_USER?.trim();
    const password = process.env.GMAIL_SMTP_APP_PASSWORD?.trim();
    const from = process.env.PORTAL_FROM_EMAIL?.trim() || user;
    if (!user || !password || !from) {
      throw new AccessRequestEmailDeliveryError(
        'NOT_CONFIGURED',
        'Access-request email delivery is not configured.',
      );
    }

    const host = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number.parseInt(process.env.GMAIL_SMTP_PORT || '465', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new AccessRequestEmailDeliveryError(
        'INVALID_SMTP_PORT',
        'Access-request email delivery is not configured.',
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

    try {
      const info = await this.transporter.sendMail({
        from: `BantAI <${from}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      const target = message.to.trim().toLowerCase();
      const accepted = (info.accepted ?? []).map((recipient) =>
        String(recipient).trim().toLowerCase(),
      );
      if (!accepted.includes(target)) {
        throw new AccessRequestEmailDeliveryError(
          'RECIPIENT_NOT_ACCEPTED',
          'The mail server did not accept the recipient.',
        );
      }
    } catch (error) {
      if (error instanceof AccessRequestEmailDeliveryError) throw error;
      const smtpError = error as {
        name?: string;
        code?: string;
        responseCode?: number;
        command?: string;
      };
      this.logger.warn(
        `Access-request email delivery failed (name=${smtpError.name || 'unknown'}, code=${smtpError.code || 'unknown'}, responseCode=${smtpError.responseCode || 'unknown'}, command=${smtpError.command || 'unknown'})`,
      );
      const rawCode = String(smtpError.code || '').toUpperCase();
      const responseCode = Number(smtpError.responseCode);
      const deliveryCode =
        rawCode === 'EAUTH'
          ? 'SMTP_AUTH_FAILED'
          : Number.isInteger(responseCode) && responseCode >= 400
            ? `SMTP_${responseCode}`
            : rawCode.startsWith('E') && /^[A-Z0-9_]+$/.test(rawCode)
              ? rawCode.slice(0, 64)
              : 'DELIVERY_FAILED';
      throw new AccessRequestEmailDeliveryError(
        deliveryCode,
        'Access-request email delivery is temporarily unavailable.',
      );
    }
  }

  private tierName(tier: AccessRequestTier) {
    void tier;
    return 'Shield Subscription';
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
