import { Injectable } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface AuditEventInput {
  type: AuditEventType;
  actorUserId?: string | null;
  targetUserId?: string | null;
  organizationId?: string | null;
  accessRequestId?: string | null;
  licenseId?: string | null;
  // Identifiers and decisions only. Never secrets, OTPs, passwords, API keys,
  // authorization headers, or SMS bodies.
  metadata?: Prisma.InputJsonValue;
}

/** Append-only lifecycle/security event log. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pass the surrounding transaction client so the event commits (or rolls
   * back) with the state change it describes.
   */
  async record(
    event: AuditEventInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        type: event.type,
        actorUserId: event.actorUserId ?? null,
        targetUserId: event.targetUserId ?? null,
        organizationId: event.organizationId ?? null,
        accessRequestId: event.accessRequestId ?? null,
        licenseId: event.licenseId ?? null,
        metadata: event.metadata,
      },
    });
  }
}
