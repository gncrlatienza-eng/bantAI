import { PrismaService } from '../../database/prisma.service';
import { PortalOrganizationsService } from './portal-organizations.service';

describe('PortalOrganizationsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    alert: { findMany: jest.fn() },
    portalOrganization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    portalAccessAudit: { create: jest.fn() },
    organizationMembership: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const service = new PortalOrganizationsService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
    );
    delete process.env.SHIELD_MAXIMUM_EXPORT_ROWS;
  });

  it('suspends a client independently from billing and records the administrator reason', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' })
      .mockResolvedValueOnce({
        id: 'client-1',
        email: 'client@example.com',
        role: 'USER',
        portalAccessStatus: 'ACTIVE',
      });
    prisma.user.update.mockResolvedValue({
      id: 'client-1',
      email: 'client@example.com',
      portalAccessStatus: 'SUSPENDED',
      portalAccessReason: 'Repeated misuse of licensed exports.',
      portalAccessUpdatedAt: new Date(),
      portalAccessUpdatedBy: 'admin-1',
    });
    prisma.portalAccessAudit.create.mockResolvedValue({
      id: 'audit-1',
      action: 'SUSPEND',
      previousStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
      reason: 'Repeated misuse of licensed exports.',
      createdAt: new Date(),
    });

    await expect(
      service.enforcePortalAccount({
        targetUserId: 'client-1',
        actorUserId: 'admin-1',
        action: 'SUSPEND',
        reason: '  Repeated misuse of licensed exports.  ',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ portalAccessStatus: 'SUSPENDED' }),
        audit: expect.objectContaining({
          action: 'SUSPEND',
          reason: 'Repeated misuse of licensed exports.',
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ license: expect.anything() }),
      }),
    );
  });

  it('does not allow an administrator to enforce their own account', async () => {
    await expect(
      service.enforcePortalAccount({
        targetUserId: 'admin-1',
        actorUserId: 'admin-1',
        action: 'REVOKE',
        reason: 'Attempted self action.',
      }),
    ).rejects.toThrow('cannot take portal enforcement action on themselves');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns only masked alert metadata for users enrolled in the organization', async () => {
    prisma.alert.findMany.mockResolvedValue([]);

    await expect(service.scopedAlertSummary('org-1')).resolves.toEqual([]);
    expect(prisma.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          message: {
            user: {
              organizationMemberships: { some: { organizationId: 'org-1' } },
            },
            NOT: { classification: { is: { bucket: 'spam' } } },
          },
        },
      }),
    );
    const select = prisma.alert.findMany.mock.calls[0][0].select.message.select;
    expect(select).not.toHaveProperty('body');
    expect(select).not.toHaveProperty('sender');
  });

  it('rejects exports over the Shield row limit', async () => {
    await expect(
      service.exportMaskedAlerts('org-1', 'SHIELD', 5_001),
    ).rejects.toThrow('at most 5000 rows');
    expect(prisma.alert.findMany).not.toHaveBeenCalled();
  });

  it('exports tenant-scoped metadata without body or sender', async () => {
    prisma.alert.findMany.mockResolvedValue([]);
    await expect(
      service.exportMaskedAlerts('org-1', 'SHIELD', 100),
    ).resolves.toEqual([]);
    const query = prisma.alert.findMany.mock.calls[0][0];
    expect(query.where.message.user.organizationMemberships).toEqual({
      some: { organizationId: 'org-1' },
    });
    expect(query.take).toBe(100);
    expect(query.where).not.toHaveProperty('createdAt');
    expect(query.select.message.select).not.toHaveProperty('body');
    expect(query.select.message.select).not.toHaveProperty('sender');
  });
});
