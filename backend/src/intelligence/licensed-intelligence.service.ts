import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { EntitlementPolicy } from '../portal-organizations/entitlement-policy';

/*
 * BantAI Intelligence — the platform-wide, masked dataset a license unlocks
 * (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.5). Deliberately
 * separate from "workspace observations" (a workspace's own members'
 * alerts, served by PortalOrganizationsService).
 *
 * Only deliberately published Shield campaign intelligence is eligible.
 * Indicators are always defanged. Raw SMS, senders, embeddings, centroids and
 * model internals never leave through this service.
 *
 * Release gate: platform-wide sharing needs adviser/privacy sign-off before
 * production. In production it stays off until INTELLIGENCE_DATA_POLICY is
 * set to "platform"; outside production it defaults on for development.
 */

export interface LicensedCampaign {
  id: string;
  label: string | null;
  isActive: boolean;
  messageCount: number;
  domains: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export function intelligenceSharingEnabled(): boolean {
  const configured = process.env.INTELLIGENCE_DATA_POLICY?.trim();
  if (configured) return configured === 'platform';
  return process.env.NODE_ENV !== 'production';
}

/* domain.example → domain[.]example — standard defanging so shared
   indicators cannot be clicked or auto-resolved by accident. */
export function defang(domain: string): string {
  return domain.replaceAll('.', '[.]');
}

const CAMPAIGN_SELECT = {
  id: true,
  label: true,
  isActive: true,
  messageCount: true,
  urlDomains: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CampaignClusterSelect;

type CampaignRow = Prisma.CampaignClusterGetPayload<{
  select: typeof CAMPAIGN_SELECT;
}>;

@Injectable()
export class LicensedIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  assertSharingEnabled(): void {
    if (!intelligenceSharingEnabled()) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'DATA_POLICY_PENDING',
        message:
          'Licensed intelligence sharing is not enabled on this deployment yet.',
      });
    }
  }

  /** Rows visible under this license (freshness window applied). */
  visibleWhere(
    policy: EntitlementPolicy,
    extra: Prisma.CampaignClusterWhereInput = {},
  ): Prisma.CampaignClusterWhereInput {
    const cutoff =
      policy.freshnessDelayMinutes > 0
        ? new Date(Date.now() - policy.freshnessDelayMinutes * 60_000)
        : null;
    return {
      ...extra,
      publishedAt: { not: null },
      ...(cutoff ? { createdAt: { lte: cutoff } } : {}),
    };
  }

  async listCampaigns(
    policy: EntitlementPolicy,
    options: {
      active?: boolean;
      search?: string;
      take?: number;
      cursor?: string;
    } = {},
  ): Promise<LicensedCampaign[]> {
    this.assertSharingEnabled();
    const search = options.search?.trim();
    const rows = await this.prisma.campaignCluster.findMany({
      where: this.visibleWhere(policy, {
        ...(options.active === undefined ? {} : { isActive: options.active }),
        ...(search
          ? {
              OR: [
                { label: { contains: search, mode: 'insensitive' } },
                { urlDomains: { has: search.toLowerCase() } },
              ],
            }
          : {}),
      }),
      orderBy: [{ messageCount: 'desc' }, { id: 'asc' }],
      select: CAMPAIGN_SELECT,
      ...(options.take ? { take: options.take } : {}),
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => this.present(row));
  }

  async getCampaign(
    policy: EntitlementPolicy,
    id: string,
  ): Promise<LicensedCampaign> {
    this.assertSharingEnabled();
    const row = await this.prisma.campaignCluster.findFirst({
      where: this.visibleWhere(policy, { id }),
      select: CAMPAIGN_SELECT,
    });
    // A campaign outside the licensed window is indistinguishable from an
    // unknown id.
    if (!row) throw new NotFoundException('Campaign not found.');
    return this.present(row);
  }

  private present(row: CampaignRow) {
    return {
      id: row.id,
      label: row.label,
      isActive: row.isActive,
      messageCount: row.messageCount,
      domains: row.urlDomains.map(defang),
      firstSeen: row.createdAt,
      lastSeen: row.updatedAt,
    };
  }
}
