import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalOrganizationsCustomerService } from './portal-organizations-customer.service';

describe('PortalOrganizationsCustomerService', () => {
  let service: PortalOrganizationsCustomerService;
  let prisma: any;

  const mockOrg = {
    id: 'org-1',
    name: 'Acme Security',
    ownerId: 'owner-1',
    isActive: true,
    createdAt: new Date(),
    accessRequest: {
      tier: 'ORGANIZATION',
      status: 'ACTIVE',
      billingPeriod: 'ANNUAL',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    },
    members: [
      {
        id: 'mem-1',
        userId: 'owner-1',
        role: 'TIER_1',
        createdAt: new Date(),
        user: {
          id: 'owner-1',
          email: 'owner@acme.com',
          firstName: 'Alice',
          lastName: 'Owner',
        },
      },
      {
        id: 'mem-2',
        userId: 'lead-1',
        role: 'TIER_1',
        createdAt: new Date(),
        user: {
          id: 'lead-1',
          email: 'lead@acme.com',
          firstName: 'Bob',
          lastName: 'Lead',
        },
      },
      {
        id: 'mem-3',
        userId: 'member-1',
        role: 'TIER_2',
        createdAt: new Date(),
        user: {
          id: 'member-1',
          email: 'user@acme.com',
          firstName: 'Charlie',
          lastName: 'User',
        },
      },
    ],
    invitations: [],
  };

  beforeEach(() => {
    prisma = {
      organizationMembership: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      portalOrganization: {
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      organizationInvitation: {
        create: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((actions) => Promise.all(actions)),
    };
    service = new PortalOrganizationsCustomerService(prisma);
  });

  describe('getMyWorkspace', () => {
    it('returns workspace with correct ownership, tier, and seat calculation', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });

      const res = await service.getMyWorkspace('owner-1');
      expect(res.organization.name).toBe('Acme Security');
      expect(res.organization.isOwner).toBe(true);
      expect(res.organization.seatLimit).toBe(10);
      expect(res.organization.seatsUsed).toBe(3);
      expect(res.members).toHaveLength(3);
    });

    it('throws NotFoundException if user has no organization', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue(null);
      await expect(service.getMyWorkspace('no-org-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('inviteMember', () => {
    it('rejects invitation attempts by TIER_2 members', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_2',
        organization: mockOrg,
      });

      await expect(
        service.inviteMember('member-1', {
          email: 'new@acme.com',
          role: 'TIER_2',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows TIER_1 member to invite a colleague', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.organizationInvitation.create.mockResolvedValue({
        id: 'inv-1',
        email: 'new@acme.com',
        role: 'TIER_2',
        status: 'PENDING',
        expiresAt: new Date(),
      });

      const res = await service.inviteMember('lead-1', {
        email: 'new@acme.com',
        role: 'TIER_2',
      });
      expect(res.invitation.email).toBe('new@acme.com');
    });
  });

  describe('removeMember', () => {
    it('prevents removing the workspace owner', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });

      await expect(service.removeMember('lead-1', 'owner-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('prevents non-owner TIER_1 from removing another TIER_1 member', async () => {
      const mockWithTwoLeads = {
        ...mockOrg,
        members: [
          ...mockOrg.members,
          {
            id: 'mem-4',
            userId: 'lead-2',
            role: 'TIER_1',
            createdAt: new Date(),
            user: {
              id: 'lead-2',
              email: 'lead2@acme.com',
              firstName: 'Dave',
              lastName: 'Lead',
            },
          },
        ],
      };
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockWithTwoLeads,
      });

      await expect(service.removeMember('lead-1', 'lead-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows owner to remove any member', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });
      prisma.organizationMembership.delete.mockResolvedValue({});

      const res = await service.removeMember('owner-1', 'member-1');
      expect(res.message).toBe('Member removed from workspace successfully.');
    });
  });

  describe('transferOwnership', () => {
    it('prevents non-owner from transferring ownership', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });

      await expect(
        service.transferOwnership('lead-1', { targetUserId: 'member-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows owner to transfer ownership to another member', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'TIER_1',
        organization: mockOrg,
      });

      const res = await service.transferOwnership('owner-1', {
        targetUserId: 'lead-1',
      });
      expect(res.message).toBe('Workspace ownership transferred successfully.');
    });
  });
});
