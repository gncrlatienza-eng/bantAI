import { AdminSystemService } from './admin-system.service';

describe('AdminSystemService audit events', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new AdminSystemService({
    auditEvent: { findMany },
  } as never);

  beforeEach(() => findMany.mockClear());

  it('hides routine restricted-content reads by default', async () => {
    await service.getAuditEvents();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: { not: 'RESTRICTED_MESSAGE_ACCESSED' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  });

  it('lists every event when routine reads are requested', async () => {
    await service.getAuditEvents({ includeReads: true });
    expect(findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('filters to one event type', async () => {
    await service.getAuditEvents({ type: 'LICENSE_ACTIVATED' as never });
    expect(findMany.mock.calls[0][0].where).toEqual({
      type: 'LICENSE_ACTIVATED',
    });
  });
});
