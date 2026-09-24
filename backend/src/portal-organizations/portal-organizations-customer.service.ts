import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  InviteMemberDto,
  TransferOwnershipDto,
} from './dto/customer-workspace.dto';

@Injectable()
export class PortalOrganizationsCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCallerMembership(userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId },
      include: {
        organization: {
          include: {
            accessRequest: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            invitations: {
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!membership || !membership.organization.isActive) {
      throw new NotFoundException(
        'You do not belong to an active organization workspace.',
      );
    }

    return membership;
  }

  async getMyWorkspace(userId: string) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;
    const isOwner = org.ownerId === userId;
    const tier = org.accessRequest?.tier ?? 'ORGANIZATION';
    const seatLimit = tier === 'RESEARCH' ? 1 : 10;
    const seatsUsed = org.members.length;

    return {
      organization: {
        id: org.id,
        name: org.name,
        ownerId: org.ownerId,
        isOwner,
        myRole: membership.role,
        seatLimit,
        seatsUsed,
        license: {
          tier,
          status: org.accessRequest?.status ?? 'ACTIVE',
          billingPeriod: org.accessRequest?.billingPeriod ?? 'ANNUAL',
          expiresAt: org.accessRequest?.expiresAt ?? null,
        },
      },
      members: org.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        phone: m.user.phone,
        role: m.role,
        isOwner: org.ownerId === m.userId,
        joinedAt: m.createdAt,
      })),
      pendingInvitations: org.invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    };
  }

  async inviteMember(userId: string, dto: InviteMemberDto) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;

    // TIER_2 members cannot invite
    if (membership.role !== 'TIER_1' && org.ownerId !== userId) {
      throw new ForbiddenException(
        'Only TIER_1 members or the workspace owner can invite new members.',
      );
    }

    const email = dto.email.trim().toLowerCase();

    // Check if email is already in members
    const existingMember = org.members.find(
      (m) => m.user.email?.toLowerCase() === email,
    );
    if (existingMember) {
      throw new ConflictException(
        'A user with this email is already a member of your workspace.',
      );
    }

    // Check seat limits
    const tier = org.accessRequest?.tier ?? 'ORGANIZATION';
    const seatLimit = tier === 'RESEARCH' ? 1 : 10;
    if (org.members.length >= seatLimit) {
      throw new BadRequestException(
        `Seat limit of ${seatLimit} reached. Upgrade your license to invite more members.`,
      );
    }

    // Check if the user already has an account
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Add directly to organization membership
      const newMembership = await this.prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: existingUser.id,
          },
        },
        create: {
          organizationId: org.id,
          userId: existingUser.id,
          role: dto.role,
        },
        update: {
          role: dto.role,
        },
      });

      return {
        message: 'Member added to workspace successfully.',
        membership: newMembership,
      };
    }

    // Otherwise create a pending invitation
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: org.id,
        email,
        role: dto.role,
        tokenHash,
        invitedBy: userId,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      message: 'Invitation created successfully.',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async removeMember(userId: string, targetUserId: string) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;
    const isCallerOwner = org.ownerId === userId;

    const targetMembership = org.members.find((m) => m.userId === targetUserId);
    if (!targetMembership) {
      throw new NotFoundException(
        'Member not found in your organization workspace.',
      );
    }

    // Cannot remove owner
    if (org.ownerId === targetUserId) {
      throw new ForbiddenException(
        'Cannot remove the workspace owner. Transfer ownership first.',
      );
    }

    // TIER_2 caller cannot remove other members (can only leave themselves)
    if (membership.role === 'TIER_2' && userId !== targetUserId) {
      throw new ForbiddenException('TIER_2 members cannot remove other members.');
    }

    // TIER_1 caller (non-owner) cannot remove other TIER_1 members
    if (
      membership.role === 'TIER_1' &&
      !isCallerOwner &&
      targetMembership.role === 'TIER_1' &&
      userId !== targetUserId
    ) {
      throw new ForbiddenException(
        'Only the Workspace Owner can remove other TIER_1 members.',
      );
    }

    await this.prisma.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: targetUserId,
        },
      },
    });

    return { message: 'Member removed from workspace successfully.' };
  }

  async transferOwnership(userId: string, dto: TransferOwnershipDto) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;

    if (org.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the current workspace owner can transfer ownership.',
      );
    }

    const targetMember = org.members.find((m) => m.userId === dto.targetUserId);
    if (!targetMember) {
      throw new NotFoundException(
        'Target user is not a member of this workspace.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.portalOrganization.update({
        where: { id: org.id },
        data: { ownerId: dto.targetUserId },
      }),
      this.prisma.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: dto.targetUserId,
          },
        },
        data: { role: 'TIER_1' },
      }),
    ]);

    return { message: 'Workspace ownership transferred successfully.' };
  }

  async revokeInvitation(userId: string, invitationId: string) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;

    if (membership.role !== 'TIER_1' && org.ownerId !== userId) {
      throw new ForbiddenException(
        'Only TIER_1 members or the workspace owner can revoke invitations.',
      );
    }

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organizationId !== org.id) {
      throw new NotFoundException('Invitation not found in your workspace.');
    }

    await this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    return { message: 'Invitation revoked successfully.' };
  }

  async getMyLicense(userId: string) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;
    const tier = org.accessRequest?.tier ?? 'ORGANIZATION';
    const seatLimit = tier === 'RESEARCH' ? 1 : 10;
    const seatsUsed = org.members.length;

    return {
      tier,
      status: org.accessRequest?.status ?? 'ACTIVE',
      seatLimit,
      seatsUsed,
      seatsRemaining: Math.max(0, seatLimit - seatsUsed),
      billingPeriod: org.accessRequest?.billingPeriod ?? 'ANNUAL',
      activatedAt: org.accessRequest?.activatedAt ?? org.createdAt,
      expiresAt: org.accessRequest?.expiresAt ?? null,
    };
  }

  async getMyBilling(userId: string) {
    const membership = await this.getCallerMembership(userId);
    const org = membership.organization;

    if (membership.role !== 'TIER_1' && org.ownerId !== userId) {
      throw new ForbiddenException(
        'TIER_2 members cannot view billing information.',
      );
    }

    const tier = org.accessRequest?.tier ?? 'ORGANIZATION';
    const period = org.accessRequest?.billingPeriod ?? 'ANNUAL';
    const status = org.accessRequest?.status ?? 'ACTIVE';

    let invoices: Array<{
      id: string;
      date: string | Date;
      amount: number;
      currency: string;
      status: string;
      pdfUrl?: string;
    }> = [];

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (stripeKey && org.accessRequest?.stripeCustomerId) {
      try {
        const StripeSDK = (await import('stripe')).default;
        const stripe = new StripeSDK(stripeKey);
        const stripeInvoices = await stripe.invoices.list({
          customer: org.accessRequest.stripeCustomerId,
          limit: 10,
        });
        invoices = stripeInvoices.data.map((inv) => ({
          id: inv.id,
          date: new Date(inv.created * 1000).toISOString(),
          amount: inv.amount_paid ? inv.amount_paid / 100 : (inv.total || 0) / 100,
          currency: (inv.currency || 'php').toUpperCase(),
          status: (inv.status || 'paid').toUpperCase(),
          pdfUrl: inv.invoice_pdf || inv.hosted_invoice_url || undefined,
        }));
      } catch {
        // Fall back to subscription record if Stripe call is unavailable
      }
    }

    if (invoices.length === 0 && org.accessRequest?.stripeSubscriptionId) {
      invoices = [
        {
          id: `sub_${org.accessRequest.stripeSubscriptionId.slice(-8)}`,
          date: org.accessRequest.activatedAt ?? org.createdAt,
          amount: tier === 'ORGANIZATION' ? (period === 'ANNUAL' ? 120000 : 12000) : 0,
          currency: 'PHP',
          status: 'PAID',
        },
      ];
    }

    return {
      currentPlan: `${tier === 'ORGANIZATION' ? 'Organization Enterprise' : 'Academic Research'} (${period})`,
      status,
      billingPeriod: period,
      nextBillingDate: org.accessRequest?.expiresAt ?? null,
      stripeCustomerId: org.accessRequest?.stripeCustomerId ? 'Configured' : null,
      invoices,
    };
  }
}
