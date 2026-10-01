import { MAX_MASKED_BODY_LENGTH, maskSmsBody } from './sms-privacy-masker';

// Mirrors mobile SmsPrivacyMaskerTest.kt so the two maskers stay in step.
describe('maskSmsBody', () => {
  it.each([
    ['Call 09171234567 now', 'Call [PHONE] now'],
    ['Contact 0917 123 4567 today', 'Contact [PHONE] today'],
    ['+63-917-123-4567 is the number', '[PHONE] is the number'],
    ['Click http://bit.ly/abc123 now', 'Click [URL] now'],
    ['Reply to scammer@example.com', 'Reply to [EMAIL]'],
    ['user.name+tag@sub.example.com', '[EMAIL]'],
    [
      'Your one-time verification code is: 123456',
      'Your one-time verification code is: [OTP]',
    ],
    ['Ref no. 8823456712, thanks', 'Ref no. [NUMBER], thanks'],
    ['Call (02) 8631-8000 for help', 'Call (02) [NUMBER] for help'],
    ['You have 3 new messages, 50% off', 'You have 3 new messages, 50% off'],
    ['You sent ₱1,500.00 to Juan', 'You sent [AMOUNT] to Juan'],
    ['Visit gcash-verify.ph/login today', 'Visit [URL] today'],
    // Server-only strictness beyond the phone masker:
    ['Open bit.ly/3xYz now', 'Open [URL] now'],
    ['Go to secure.gcash-help.com', 'Go to [URL]'],
  ])('masks %j', (raw, expected) => {
    expect(maskSmsBody(raw)).toBe(expected);
  });

  it('leaves already-masked client text unchanged', () => {
    const masked =
      'Your GCash is locked. Verify at [URL] or call [PHONE]. Code [OTP], ref [NUMBER], [AMOUNT] [EMAIL]';
    expect(maskSmsBody(masked)).toBe(masked);
    expect(maskSmsBody(maskSmsBody(masked))).toBe(masked);
  });

  it('applies NFKC before matching so full-width digits cannot slip through', () => {
    expect(maskSmsBody('Tawag sa ０９１７１２３４５６７')).toBe(
      'Tawag sa [PHONE]',
    );
  });

  it('collapses whitespace and caps length like the mobile masker', () => {
    expect(maskSmsBody('  a \n\t b  ')).toBe('a b');
    expect(maskSmsBody('x'.repeat(MAX_MASKED_BODY_LENGTH + 50))).toHaveLength(
      MAX_MASKED_BODY_LENGTH,
    );
  });
});
