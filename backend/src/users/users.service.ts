import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    return this.prisma.user.update({
      where: { id: userId },
      // Explicit field list: never spread the DTO, so the login email (and
      // any other identity field) cannot be written through this route.
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...trainingConsentUpdate(user.trainingOptIn, dto.trainingOptIn),
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
        trainingOptIn: true,
      },
    });
  }

  async deleteMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    // Explicit order keeps this portable across existing restrictive foreign
    // keys and permanently removes every user-owned record.
    await this.prisma.$transaction(async (tx) => {
      const affectedCampaigns = await tx.smsMessage.findMany({
        where: { userId, clusterId: { not: null } },
        select: { clusterId: true },
      });
      const affectedSenderReports = await tx.senderReport.findMany({
        where: { userId },
        select: { sender: true, reportWindow: true },
      });
      await tx.explainableIndicator.deleteMany({
        where: { classification: { message: { userId } } },
      });
      await tx.alert.deleteMany({ where: { message: { userId } } });
      await tx.messageFeature.deleteMany({ where: { message: { userId } } });
      await tx.classification.deleteMany({ where: { message: { userId } } });
      // Same Restrict FKs as the retention purge: keep curated samples by
      // detaching them, and drop the deleted messages' assignment history.
      await tx.datasetSample.updateMany({
        where: { sourceReport: { userId } },
        data: { sourceReportId: null },
      });
      await tx.userReport.deleteMany({ where: { userId } });
      await tx.campaignAssignmentHistory.deleteMany({
        where: { message: { userId } },
      });
      await tx.smsMessage.deleteMany({ where: { userId } });
      await tx.contact.deleteMany({ where: { userId } });
      await tx.blockedNumber.deleteMany({ where: { userId } });
      await tx.senderReport.deleteMany({ where: { userId } });
      for (const { sender, reportWindow } of affectedSenderReports) {
        const remainingValidated = await tx.senderReport.count({
          where: { sender, reportWindow, status: 'Validated' },
        });
        if (remainingValidated < 2) {
          await tx.senderVerificationCache.deleteMany({
            where: { sender, source: 'corroborated-admin-review' },
          });
        }
      }
      await tx.user.delete({ where: { id: userId } });
      const clusterIds = [
        ...new Set(
          affectedCampaigns.flatMap(({ clusterId }) =>
            clusterId ? [clusterId] : [],
          ),
        ),
      ];
      for (const clusterId of clusterIds) {
        const messageCount = await tx.smsMessage.count({
          where: { clusterId, trusted: true },
        });
        await tx.campaignCluster.update({
          where: { id: clusterId },
          data: { messageCount },
        });
      }
    });
  }
}

/*
 * Training consent. Opting in stamps the time: only messages the server
 * ingests afterwards can be queued for review. Opting in again while already
 * in keeps the original time; opting out clears it, so a later opt-in never
 * covers messages from the opted-out period.
 */
export function trainingConsentUpdate(
  current: boolean,
  requested: boolean | undefined,
): { trainingOptIn?: boolean; trainingOptInAt?: Date | null } {
  if (requested === undefined || requested === current) return {};
  return requested
    ? { trainingOptIn: true, trainingOptInAt: new Date() }
    : { trainingOptIn: false, trainingOptInAt: null };
}
