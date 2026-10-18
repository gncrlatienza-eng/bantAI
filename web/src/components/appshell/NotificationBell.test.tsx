import { describe, expect, it } from 'vitest';

import { unreadBadgeText } from './NotificationBell';

describe('unreadBadgeText', () => {
  it('hides the badge at zero and caps it at 99+', () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(3)).toBe('3');
    expect(unreadBadgeText(99)).toBe('99');
    expect(unreadBadgeText(140)).toBe('99+');
  });
});
