import { sanitizePath } from './request-log.interceptor';

describe('sanitizePath', () => {
  it('uses dynamic parameter names instead of logging identifier values', () => {
    expect(
      sanitizePath('/api/users/alice@example.com/messages/+639171234567', {
        email: 'alice@example.com',
        phone: '+639171234567',
      }),
    ).toBe('/api/users/:email/messages/:phone');
  });

  it('removes query strings and conservatively redacts phone/email fallbacks', () => {
    expect(
      sanitizePath('/api/find/alice@example.com/+63 917 123 4567?token=secret'),
    ).toBe('/api/find/:email/:phone');
  });
});
