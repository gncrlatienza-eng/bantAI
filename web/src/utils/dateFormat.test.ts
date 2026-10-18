import { describe, expect, it } from 'vitest';

import { formatCompactDateTime } from './dateFormat';

describe('formatCompactDateTime', () => {
  const now = new Date(2026, 9, 17, 12, 0);

  it('leaves the year out for dates in the current year', () => {
    const out = formatCompactDateTime(new Date(2026, 8, 23, 14, 23), now);
    expect(out).not.toContain('2026');
    expect(out).toContain('23');
  });

  it('keeps the year for other years', () => {
    expect(formatCompactDateTime(new Date(2025, 11, 1, 9, 5), now)).toContain(
      '2025',
    );
  });
});
