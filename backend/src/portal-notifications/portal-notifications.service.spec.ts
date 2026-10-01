import { NotFoundException } from '@nestjs/common';
import { NotificationAudience } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ModelsService } from '../models/models.service';
import { PortalNotificationsService } from './portal-notifications.service';

const ALL_ON = {
  inAppEnabled: true,
  campaignChangesEnabled: true,
  subscriptionUpdatesEnabled: true,
  apiUsageAlertsEnabled: true,
  systemHealthAlertsEnabled: true,
};

function makePrisma() {
  return {
    notificationPreference: { upsert: jest.fn().mockResolvedValue(ALL_ON) },
    portalNotification: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'n1' }),
    },
    organizationMembership: {
      findMany: jest.fn().mockResolvedValue([{ organizationId: 'org-1' }]),
    },
    campaignCluster: { findMany: jest.fn().mockResolvedValue([]) },
    campaignEvolutionEvent: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { findMany: jest.fn().mockResolvedValue([]) },
    license: { findMany: jest.fn().mockResolvedValue([]) },
    portalOrganization: { findMany: jest.fn().mockResolvedValue([]) },
    shieldApiRequest: { groupBy: jest.fn().mockResolvedValue([]) },
    accessRequest: { findMany: jest.fn().mockResolvedValue([]) },
    modelVersion: { findMany: jest.fn().mockResolvedValue([]) },
    retrainingJob: { findMany: jest.fn().mockResolvedValue([]) },
    driftInvestigation: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const models = {
  getServingStatus: jest.fn().mockResolvedValue({
    status: 'ready',
    matchesRegistry: true,
    versionTag: 'v1',
  }),
} as unknown as ModelsService;

describe('PortalNotificationsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: PortalNotificationsService;
  const now = new Date('2026-09-30T08:00:00Z');

  beforeEach(() => {
    prisma = makePrisma();
    service = new PortalNotificationsService(
      prisma as unknown as PrismaService,
      models,
    );
  });

  it('stores each notice per recipient and never duplicates it', async () => {
    prisma.campaignCluster.findMany.mockResolvedValue([
      {
        id: 'c1',
        label: 'Parcel lure',
        risk: 'HIGH',
        publishedAt: new Date('2026-09-29T00:00:00Z'),
      },
    ]);

    await service.syncSystemEvents('user-a', NotificationAudience.SHIELD);

    expect(prisma.portalNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-a',
          audience: 'SHIELD',
          sourceKey: 'campaign-published:c1:2026-09-29T00:00:00.000Z',
          link: '/shield/campaigns/c1',
          createdAt: new Date('2026-09-29T00:00:00Z'),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('only reads audit events for the member’s own organizations', async () => {
    await service.shieldCandidates('user-a', ALL_ON, now);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: { in: ['org-1'] } }),
      }),
    );
  });

  it('skips organization events for a user without memberships', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([]);
    await service.shieldCandidates('user-a', ALL_ON, now);
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.license.findMany).not.toHaveBeenCalled();
  });

  it('respects a disabled category', async () => {
    await service.shieldCandidates(
      'user-a',
      {
        ...ALL_ON,
        campaignChangesEnabled: false,
        apiUsageAlertsEnabled: false,
      },
      now,
    );
    expect(prisma.campaignCluster.findMany).not.toHaveBeenCalled();
    expect(prisma.shieldApiRequest.groupBy).not.toHaveBeenCalled();
  });

  it('creates nothing while in-app notifications are off', async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({
      ...ALL_ON,
      inAppEnabled: false,
    });
    await service.syncSystemEvents('user-a', NotificationAudience.SHIELD);
    expect(prisma.portalNotification.createMany).not.toHaveBeenCalled();
  });

  it('warns at 80% and 100% of the monthly quota', async () => {
    prisma.portalOrganization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'DLSL', apiMonthlyQuota: 100 },
    ]);
    prisma.shieldApiRequest.groupBy.mockResolvedValueOnce([
      { organizationId: 'org-1', _count: { _all: 85 } },
    ]);
    const warning = await service.shieldCandidates('user-a', ALL_ON, now);
    expect(warning).toContainEqual(
      expect.objectContaining({
        type: 'API_QUOTA_WARNING',
        sourceKey: 'api-quota-80:org-1:2026-09',
      }),
    );

    prisma.shieldApiRequest.groupBy.mockResolvedValueOnce([
      { organizationId: 'org-1', _count: { _all: 100 } },
    ]);
    const reached = await service.shieldCandidates('user-a', ALL_ON, now);
    expect(reached).toContainEqual(
      expect.objectContaining({ type: 'API_QUOTA_REACHED' }),
    );
    expect(prisma.shieldApiRequest.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-09-01T00:00:00Z') },
        }),
      }),
    );
  });

  it('flags a serving model that differs from the registry for Admins', async () => {
    (models.getServingStatus as jest.Mock).mockResolvedValueOnce({
      status: 'ready',
      matchesRegistry: false,
      versionTag: 'candidate-x',
    });
    const candidates = await service.adminCandidates(ALL_ON, now);
    expect(candidates).toContainEqual(
      expect.objectContaining({ type: 'MODEL_REGISTRY_MISMATCH' }),
    );
  });

  it('cannot mark another user’s notice as read', async () => {
    prisma.portalNotification.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markRead('user-a', NotificationAudience.SHIELD, 'n-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portalNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-other', userId: 'user-a', audience: 'SHIELD' },
      data: { readAt: expect.any(Date) },
    });
  });
});
