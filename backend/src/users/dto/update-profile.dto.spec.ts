import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateProfileDto } from './update-profile.dto';

// Mirrors the global ValidationPipe options in main.ts.
const validateBody = (body: Record<string, unknown>) =>
  validate(plainToInstance(UpdateProfileDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateProfileDto', () => {
  it('accepts display-name edits', async () => {
    await expect(
      validateBody({ firstName: 'Reymark', lastName: 'De Castro' }),
    ).resolves.toHaveLength(0);
  });

  // Audit AUTH-02 (2026-10-13): PUT /users/me must not change the login email.
  it('rejects a body that tries to change the login email', async () => {
    const errors = await validateBody({
      firstName: 'Reymark',
      email: 'attacker@example.com',
    });

    expect(errors.map((e) => e.property)).toContain('email');
  });
});
