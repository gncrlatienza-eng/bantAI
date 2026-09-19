import { PrismaService } from '../../database/prisma.service';
import { PortalOrganizationsService } from './portal-organizations.service';

describe('PortalOrganizationsService', () => {
  const prisma = {
    alert: { findMany: jest.fn() },
  };
  const service = new PortalOrganizationsService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

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
          },
        },
      }),
    );
    const select = prisma.alert.findMany.mock.calls[0][0].select.message.select;
    expect(select).not.toHaveProperty('body');
    expect(select).not.toHaveProperty('sender');
  });
});
