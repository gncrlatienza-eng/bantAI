/**
 * Canonical form for Philippine mobile numbers used as account identifiers.
 * Only +639XXXXXXXXX is accepted; landlines and arbitrary international
 * numbers must not silently become a Philippine account.
 */
export function normalizePhilippineMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const national = digits.startsWith('0063')
    ? digits.slice(4)
    : digits.startsWith('63')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  return /^9\d{9}$/.test(national) ? `+63${national}` : null;
}

export function normalizeSender(value: string): string {
  if (/[a-zA-Z]/.test(value)) return value.trim().toLowerCase();
  return normalizePhilippineMobile(value) ?? value.replace(/\D/g, '');
}

/** Stable server-side pseudonym for a sender or contact number. */
export function fingerprintSender(value: string): string {
  const secret = process.env.SENDER_HASH_SECRET;
  if (!secret)
    throw new Error('SENDER_HASH_SECRET environment variable is not set.');
  return createHmac('sha256', secret)
    .update(normalizeSender(value))
    .digest('hex');
}
import { createHmac } from 'crypto';
