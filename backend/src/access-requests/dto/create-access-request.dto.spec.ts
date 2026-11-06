import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateAccessRequestDto } from './create-access-request.dto';

/* Mirrors the global pipe in main.ts so these cases match the live API. */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});
const validate = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreateAccessRequestDto });

const base = {
  fullName: 'Ana Santos',
  email: 'ana@uni.edu.ph',
  organization: 'Example University',
  applicantRole: 'Graduate researcher',
  intendedUse: 'Measure campaign reuse across senders.',
  reason: 'Thesis on Philippine smishing campaign evolution.',
  expectedUsers: 2,
  accuracyConfirmed: true,
};
const organizationDetails = {
  website: 'acme.example.ph',
  deployment: 'Internal fraud analysis for the SOC team.',
  dataAccess: 'EXPORTS_AND_API',
};

describe('CreateAccessRequestDto', () => {
  it('accepts a complete Shield request', async () => {
    await expect(
      validate({ ...base, tier: 'shield', organizationDetails }),
    ).resolves.toBeInstanceOf(CreateAccessRequestDto);
  });

  it('rejects retired subscription tiers', async () => {
    await expect(
      validate({ ...base, tier: 'research' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate({ ...base, tier: 'organization', organizationDetails }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the accuracy confirmation to be true', async () => {
    await expect(
      validate({
        ...base,
        tier: 'shield',
        organizationDetails,
        accuracyConfirmed: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects data BantAI does not ask for', async () => {
    await expect(
      validate({
        ...base,
        tier: 'shield',
        organizationDetails,
        phoneNumber: '+63 917 000 0000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates optional Shield organization metadata', async () => {
    await expect(
      validate({ ...base, tier: 'shield', organizationDetails }),
    ).resolves.toBeInstanceOf(CreateAccessRequestDto);
    await expect(
      validate({
        ...base,
        tier: 'shield',
        organizationDetails: { ...organizationDetails, dataAccess: 'RAW_DUMP' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
