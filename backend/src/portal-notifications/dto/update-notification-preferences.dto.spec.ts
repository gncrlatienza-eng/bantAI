import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';

// Same options as the global ValidationPipe in main.ts.
async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(UpdateNotificationPreferencesDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdateNotificationPreferencesDto', () => {
  it('accepts settings that have a delivery path', async () => {
    await expect(
      errorsFor({ inAppEnabled: true, apiUsageAlertsEnabled: false }),
    ).resolves.toHaveLength(0);
  });

  it.each(['emailEnabled', 'exportUpdatesEnabled'])(
    'rejects %s until its delivery exists',
    async (field) => {
      const errors = await errorsFor({ [field]: true });
      expect(errors.map((error) => error.property)).toEqual([field]);
    },
  );
});
