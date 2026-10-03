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
// Plain "P" amounts ("P5,000", "P 250.00") -- the commonest way pesos are
// written. Case-sensitive and bounded on both sides so "P2P"/"MP3" survive.
const PESO_P = /(?<![A-Za-z0-9])P\s?\d[\d,]*(?:\.\d+)?(?![A-Za-z0-9])/g;
// "MPIN", "passcode", "security number" etc.: a 4-digit e-wallet MPIN is too
// short for the generic digit-run mask, so it needs its own keyword.
const OTP = new RegExp(
  `\\b(otp|code|pin|mpin|passcode|password|tac|security\\s+(?:code|number)|verification\\s+number)(\\D{0,${OTP_KEYWORD_GAP}})\\d{4,8}\\b`,
  'gi',
);
// A transaction reference after its label: "Ref No. 1234 567 890123",
// "RefNo1234567890123", "Reference: 7B3K9Q2X1M", "Transaction ID 12345". The
// generic run below misses these when the digits touch the label, mix in
// letters, or are under six digits. The code must hold a digit and be 4+
// characters, so "for your reference" or "transfer" are left alone. Masked as
// [NUMBER], the placeholder the AI service and dashboard already know.
const REFERENCE =
  /\b(ref(?:erence)?|txn|trans(?:action)?|trace)(\.?\s*(?:no|num|number|id|code)?\.?\s*[:#]?\s*)(?=[a-z0-9-]*\d)(?=[a-z0-9-]{4})[a-z0-9][a-z0-9-]*(?:\s+\d[a-z0-9-]*)*/gi;
// Up to two spaces/hyphens between digits, so a double-spaced
// "1234  567  890123" is one run rather than a tail with its head left behind.
const GENERIC_DIGIT_RUN = new RegExp(
  `(?<!\\w)\\d(?:[\\s-]{0,2}\\d){${MIN_GENERIC_DIGIT_RUN - 1},}(?!\\w)`,
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
      .replace(PESO_P, '[AMOUNT]')
      .replace(OTP, '$1$2[OTP]')
      .replace(REFERENCE, '$1$2[NUMBER]')
      .replace(GENERIC_DIGIT_RUN, '[NUMBER]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MASKED_BODY_LENGTH)
  );
}
