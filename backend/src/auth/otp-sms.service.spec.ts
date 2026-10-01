import { ServiceUnavailableException } from '@nestjs/common';
import { OtpSmsService } from './otp-sms.service';

describe('OtpSmsService', () => {
  const originalApiKey = process.env.SEMAPHORE_API_KEY;
  const originalSenderName = process.env.SEMAPHORE_SENDER_NAME;

  beforeEach(() => {
    process.env.SEMAPHORE_API_KEY = 'test-api-key';
    delete process.env.SEMAPHORE_SENDER_NAME;
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalApiKey === undefined) {
      delete process.env.SEMAPHORE_API_KEY;
    } else {
      process.env.SEMAPHORE_API_KEY = originalApiKey;
    }

    if (originalSenderName === undefined) {
      delete process.env.SEMAPHORE_SENDER_NAME;
    } else {
      process.env.SEMAPHORE_SENDER_NAME = originalSenderName;
    }
  });

  it('uses the configured Semaphore sender name', async () => {
    process.env.SEMAPHORE_SENDER_NAME = 'BANTAIPH';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    await new OtpSmsService().send('+639171234567', '123456');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.semaphore.co/api/v4/messages');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(options?.body as string)).toMatchObject({
      apikey: 'test-api-key',
      number: '+639171234567',
      message:
        'Your BantAI verification code is: 123456. Valid for 5 minutes. Do not share this code.',
      sendername: 'BANTAIPH',
    });
  });

  it('defaults to BANTAIPH when no sender name is configured', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    await new OtpSmsService().send('+639171234567', '123456');

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options?.body as string)).toMatchObject({
      sendername: 'BANTAIPH',
    });
  });

  it('fails closed when the Semaphore API key is missing', async () => {
    delete process.env.SEMAPHORE_API_KEY;
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(
      new OtpSmsService().send('+639171234567', '123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when Semaphore rejects the request', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(
      new OtpSmsService().send('+639171234567', '123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
