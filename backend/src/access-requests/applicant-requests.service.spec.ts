import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccessRequestStatus, AccessRequestTier } from '@prisma/client';

import { ApplicantRequestsService } from './applicant-requests.service';
import { AGREEMENT_VERSION } from './license-terms';

const shieldApplication = {
  tier: AccessRequestTier.SHIELD,
  fullName: ' Ana Santos ',
  organization: 'Example University',
  applicantRole: 'Graduate researcher',
  intendedUse: 'Measure campaign reuse across senders.',
  reason: 'Thesis on Philippine smishing campaign evolution.',
  expectedUsers: 2,
  organizationDetails: {
    website: 'uni.edu.ph',
    deployment: 'Internal campaign intelligence review.',
    dataAccess: 'EXPORTS_AND_API' as const,
  },
  accuracyConfirmed: true,
  pilotInterest: true,
};

describe('ApplicantRequestsService (account-first applications)', () => {
  const prisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    accessRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    accessRequestToken: { updateMany: jest.fn() },
    license: { findFirst: jest.fn() },
    organizationMembership: { findFirst: jest.fn() },
  };
  const accessRequests = {
    deliverSubmissionReceipt: jest.fn().mockResolvedValue(true),
  };
  const audit = { record: jest.fn() };
  const service = new ApplicantRequestsService(
    prisma as never,
    accessRequests as never,
    audit as never,
  );

  const readyUser = {
    email: 'ana@uni.edu.ph',
    role: 'USER',
    webRole: 'SHIELD',
    portalAccessStatus: 'ACTIVE',
    emailVerifiedAt: new Date('2026-09-01'),
    onboardingStatus: 'COMPLETE',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.ACCESS_REQUEST_REAPPLY_COOLDOWN_DAYS;
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
    );
    prisma.user.findUnique.mockResolvedValue(readyUser);
    // assertNoOtherOpenRequest → none; previous request → none by default.
    prisma.accessRequest.findFirst.mockResolvedValue(null);
    prisma.license.findFirst.mockResolvedValue(null);
    prisma.organizationMembership.findFirst.mockResolvedValue(null);
    accessRequests.deliverSubmissionReceipt.mockResolvedValue(true);
    prisma.accessRequest.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'request-2',
          status: AccessRequestStatus.RECEIVED,
          referenceNumber: 7,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          infoRequestedAt: null,
          approvedAt: null,
          declinedAt: null,
          withdrawnAt: null,
          agreementAcceptedAt: null,
          activatedAt: null,
          ...data,
        }),
    );
  });

  it.each([
    [
      'setup is unfinished',
      { onboardingStatus: 'IN_PROGRESS' },
      'SETUP_REQUIRED',
    ],
    [
      'the email is unverified',
      { emailVerifiedAt: null },
      'EMAIL_NOT_VERIFIED',
    ],
    [
      'the account is suspended',
      { portalAccessStatus: 'SUSPENDED' },
      'ACCOUNT_RESTRICTED',
    ],
    ['it is a staff account', { webRole: 'ADMIN' }, 'ACCOUNT_NOT_ELIGIBLE'],
  ])('refuses a request when %s', async (_label, override, code) => {
    prisma.user.findUnique.mockResolvedValue({ ...readyUser, ...override });
    await expect(
      service.submit('user-1', shieldApplication),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  it('refuses a second open request for the same account', async () => {
    prisma.accessRequest.findFirst.mockResolvedValueOnce({ id: 'open-1' });
    await expect(
      service.submit('user-1', shieldApplication),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  it('refuses a Shield subscription the account already holds', async () => {
    prisma.license.findFirst.mockResolvedValueOnce({ id: 'license-1' });
    await expect(
      service.submit('user-1', shieldApplication),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ALREADY_ACTIVE' }),
    });
  });

  it('refuses a re-request while the latest license is suspended', async () => {
    prisma.license.findFirst
      .mockResolvedValueOnce(null) // not already active
      .mockResolvedValueOnce({ status: 'PAST_DUE', validUntil: null });
    await expect(
      service.submit('user-1', shieldApplication),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces the configured cooldown after a decline', async () => {
    process.env.ACCESS_REQUEST_REAPPLY_COOLDOWN_DAYS = '14';
    prisma.accessRequest.findFirst
      .mockResolvedValueOnce(null) // no open request
      .mockResolvedValueOnce({
        id: 'declined-1',
        status: AccessRequestStatus.DECLINED,
        declinedAt: new Date(Date.now() - 2 * 86_400_000),
      });
    await expect(
      service.submit('user-1', shieldApplication),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REAPPLY_COOLDOWN' }),
    });
  });

  it('files a re-request under the same account, linked to history and the owned workspace', async () => {
    prisma.accessRequest.findFirst
      .mockResolvedValueOnce(null) // no open request
      .mockResolvedValueOnce({
        id: 'request-1',
        status: AccessRequestStatus.ACTIVE,
        declinedAt: null,
      });
    prisma.organizationMembership.findFirst.mockResolvedValue({
      organizationId: 'org-1',
    });

    const result = await service.submit('user-1', {
      ...shieldApplication,
      // A body email is not part of the DTO; even if smuggled in, the
      // account email wins.
      email: 'attacker@example.com',
    } as never);

    expect(prisma.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ana@uni.edu.ph',
        fullName: 'Ana Santos',
        portalUserId: 'user-1',
        portalOrganizationId: 'org-1',
        previousAccessRequestId: 'request-1',
        pilotInterest: true,
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPLICATION_SUBMITTED',
        targetUserId: 'user-1',
        metadata: expect.objectContaining({ returningApplicant: true }),
      }),
      prisma,
    );
    expect(result).toMatchObject({
      reference: 'BAI-2026-00007',
      status: 'received',
      returningApplicant: true,
      confirmationEmailSent: true,
    });
  });

  it('withdraws only the caller’s own request, before payment', async () => {
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.withdraw('user-1', 'someone-elses'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'someone-elses',
          portalUserId: 'user-1',
          status: {
            in: expect.not.arrayContaining([
              AccessRequestStatus.PAYMENT_PENDING,
            ]),
          },
        }),
      }),
    );
  });

  it('rejects stale agreement versions and foreign requests', async () => {
    await expect(
      service.acceptAgreement('user-1', 'request-1', 'old-version'),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.accessRequest.findFirst.mockResolvedValue(null);
    await expect(
      service.acceptAgreement('user-1', 'request-9', AGREEMENT_VERSION),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'request-9', portalUserId: 'user-1' },
    });
  });
});
