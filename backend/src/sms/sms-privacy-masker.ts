/**
 * Server-side port of the mobile `SmsPrivacyMasker`
 * (mobile/app/src/main/java/com/bantai/util/SmsPrivacyMasker.kt).
 *
 * The phone masks an SMS before upload, but the backend cannot verify which
 * client produced a payload: a modified or older build could send an original
 * body under the `maskedBody` key. Every body is therefore re-masked here
 * before it reaches the AI service, storage, curation, or a dataset export.
 *
 * Re-masking an already-masked body is a no-op for the placeholders the phone
 * emits ([URL], [EMAIL], [PHONE], [AMOUNT], [OTP], [NUMBER]), so a compliant
 * client's text is stored unchanged. Where this port differs from the phone
 * (Unicode word boundaries, subdomains, pathed short links), the server masks
 * more, never less.
 *
 * Keep the patterns and their order in sync with the Kotlin masker.
 */

export const MAX_MASKED_BODY_LENGTH = 1600;

const OTP_KEYWORD_GAP = 40;
const MIN_GENERIC_DIGIT_RUN = 6;

const URL = /\bhttps?:\/\/[^\s<>()]+/gi;
// Stricter than the phone in two places, both idempotent on masked text:
// subdomains are consumed with the domain ("sub.example.com" -> "[URL]", not
// "sub.[URL]"), and a domain with any alphabetic TLD is masked when it carries
// a path ("bit.ly/abc"), since the path is what holds a per-victim token.
const BARE_DOMAIN =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|ph|io|co|xyz|info|tk|top|link|app)\b(?:\/[^\s<>()]*)?/gi;
const PATHED_DOMAIN =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\/[^\s<>()]*/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE = /(?<!\w)(?:\+63[\s-]?|0)9(?:[\s-]?\d){9}(?!\w)/g;
const MONEY = /(?:₱|PHP\s?)\d+(?:[,.]\d+)*/gi;
const OTP = new RegExp(
  `\\b(otp|code|pin)(\\D{0,${OTP_KEYWORD_GAP}})\\d{4,8}\\b`,
  'gi',
);
const GENERIC_DIGIT_RUN = new RegExp(
  `(?<!\\w)\\d(?:[\\s-]?\\d){${MIN_GENERIC_DIGIT_RUN - 1},}(?!\\w)`,
  'g',
);

export function maskSmsBody(body: string): string {
  return (
    body
      .normalize('NFKC')
      .replace(URL, '[URL]')
      // Email before bare domain, or "user@example.com" leaks "user@[URL]".
      .replace(EMAIL, '[EMAIL]')
      .replace(BARE_DOMAIN, '[URL]')
      .replace(PATHED_DOMAIN, '[URL]')
      .replace(PHONE, '[PHONE]')
      .replace(MONEY, '[AMOUNT]')
      .replace(OTP, '$1$2[OTP]')
      .replace(GENERIC_DIGIT_RUN, '[NUMBER]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MASKED_BODY_LENGTH)
  );
}
