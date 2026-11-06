import { describe, expect, it } from 'vitest';

import { accessRequestCounts, detailValue } from './AccessRequestsPage';

describe('detailValue', () => {
  it('shows what the applicant typed exactly as typed', () => {
    expect(detailValue('bantai.ph.com')).toBe('bantai.ph.com');
    expect(
      detailValue('BantAI will be deployed as a web-based prototype.'),
    ).toBe('BantAI will be deployed as a web-based prototype.');
  });

  it('humanizes enum answers in sentence case', () => {
    expect(detailValue('EXPORTS_AND_API')).toBe('Exports and API');
    expect(detailValue('six_months')).toBe('Six months');
  });

  it('formats booleans and blanks', () => {
    expect(detailValue(true)).toBe('Yes');
    expect(detailValue(false)).toBe('No');
    expect(detailValue('')).toBe('—');
    expect(detailValue(undefined)).toBe('—');
  });
});

describe('accessRequestCounts', () => {
  it('counts a Shield request waiting for payment', () => {
    const counts = accessRequestCounts([
      { status: 'PAYMENT_PENDING', tier: 'SHIELD' },
      { status: 'RECEIVED', tier: 'SHIELD' },
      { status: 'ACTIVE', tier: 'SHIELD' },
      { status: 'DECLINED', tier: 'SHIELD' },
    ]);
    expect(counts).toEqual({
      pending: 1,
      awaitingPayment: 1,
      openShield: 2,
      active: 1,
    });
  });
});
