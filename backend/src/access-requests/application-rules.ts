import { ConflictException } from '@nestjs/common';
import { AccessRequestStatus, Prisma } from '@prisma/client';

/*
 * Application lifecycle rules shared by the admin and applicant services.
 * Application status is separate from license status: once a request is
 * ACTIVE (activated) it never changes again; expiry, suspension, and
 * cancellation are recorded on the License only.
 */

/** Requests that are still moving toward activation. */
export const OPEN_REQUEST_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.RECEIVED,
  AccessRequestStatus.UNDER_REVIEW,
  AccessRequestStatus.MORE_INFO_REQUIRED,
  AccessRequestStatus.APPROVED,
  AccessRequestStatus.AGREEMENT_ACCEPTED,
  AccessRequestStatus.PAYMENT_PENDING,
];

/** Awaiting a human decision. */
export const PENDING_REVIEW_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.RECEIVED,
  AccessRequestStatus.UNDER_REVIEW,
  AccessRequestStatus.MORE_INFO_REQUIRED,
];

/*
 * An applicant may withdraw until checkout starts. PAYMENT_PENDING is
 * excluded: a withdrawal racing a completed Stripe payment would leave the
 * customer charged without access.
 */
export const WITHDRAWABLE_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.RECEIVED,
  AccessRequestStatus.UNDER_REVIEW,
  AccessRequestStatus.MORE_INFO_REQUIRED,
  AccessRequestStatus.APPROVED,
  AccessRequestStatus.AGREEMENT_ACCEPTED,
];

/**
 * One open request per account, or per email for legacy requests no account
 * has claimed yet. Call inside the caller's Serializable transaction — Prisma 5
 * cannot express the equivalent partial unique index without schema drift.
 */
export async function assertNoOtherOpenRequest(
  tx: Prisma.TransactionClient,
  params: { userId: string | null; email: string; excludeId?: string },
): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const conflict = await tx.accessRequest.findFirst({
    where: {
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      status: { in: OPEN_REQUEST_STATUSES },
      OR: [
        ...(params.userId ? [{ portalUserId: params.userId }] : []),
        { email: { equals: email, mode: 'insensitive' as const } },
      ],
    },
    select: { id: true },
  });
  if (conflict) {
    throw new ConflictException({
      statusCode: 409,
      code: 'OPEN_REQUEST_EXISTS',
      message: 'This account already has an access request in progress.',
    });
  }
}

/** Days a declined applicant waits before reapplying (server-enforced). */
export function reapplyCooldownDays(): number {
  const parsed = Number.parseInt(
    process.env.ACCESS_REQUEST_REAPPLY_COOLDOWN_DAYS ?? '',
    10,
  );
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
