import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RejectReportDto, ReviewReportDto } from './review-report.dto';

// Mirrors the global ValidationPipe options in main.ts: an invalid or
// unexpected field becomes a 400 before reaching the controller.
const errorsFor = <T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) =>
  validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('RejectReportDto', () => {
  it.each(['Ham', 'Spam'])('accepts reviewedLabel %s', async (label) => {
    await expect(
      errorsFor(RejectReportDto, { reviewedLabel: label }),
    ).resolves.toHaveLength(0);
  });

  it('allows rejecting without a label', async () => {
    await expect(
      errorsFor(RejectReportDto, { adminNote: 'n/a' }),
    ).resolves.toHaveLength(0);
  });

  it.each(['Scam', 'ham', ''])('rejects reviewedLabel %p', async (label) => {
    const errors = await errorsFor(RejectReportDto, { reviewedLabel: label });
    expect(errors.map((e) => e.property)).toContain('reviewedLabel');
  });
});

describe('ReviewReportDto (validate)', () => {
  it('refuses reviewedLabel: an accepted report keeps the user label', async () => {
    const errors = await errorsFor(ReviewReportDto, { reviewedLabel: 'Ham' });
    expect(errors.map((e) => e.property)).toContain('reviewedLabel');
  });
});
