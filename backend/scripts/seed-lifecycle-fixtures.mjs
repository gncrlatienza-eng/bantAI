/*
 * Dev-only fixtures: one web account per access-lifecycle state, so the
 * resolver, route guards, and pages can be exercised against a real database
 * (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.10).
 *
 *   node --env-file=.env scripts/seed-lifecycle-fixtures.mjs           # (re)create
 *   node --env-file=.env scripts/seed-lifecycle-fixtures.mjs --remove  # delete
 *
 * Refuses to run in production or against a non-local database. Every row it
 * touches uses an @lifecycle.test address or a "Lifecycle " workspace name.
 * Password for every fixture: LIFECYCLE_FIXTURE_PASSWORD, default below.
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const DOMAIN = 'lifecycle.test';
const PASSWORD =
  process.env.LIFECYCLE_FIXTURE_PASSWORD || 'lifecycle-fixture-only';
const DAY = 86_400_000;

const url = process.env.DATABASE_URL ?? '';
if (
  process.env.NODE_ENV === 'production' ||
  !/@(localhost|127\.0\.0\.1)[:/]/.test(url)
) {
  console.error(
    'Refusing: lifecycle fixtures are for a local development database only.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function removeFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const requests = await prisma.accessRequest.findMany({
    where: { email: { endsWith: `@${DOMAIN}` } },
    select: { id: true },
  });
  const requestIds = requests.map((request) => request.id);
  await prisma.license.deleteMany({
    where: { accessRequestId: { in: requestIds } },
  });
  await prisma.accessRequest.updateMany({
    where: { id: { in: requestIds } },
    data: { previousAccessRequestId: null },
  });
  await prisma.accessRequest.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.organizationMembership.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.portalOrganization.deleteMany({
    where: { name: { startsWith: 'Lifecycle ' } },
  });
  await prisma.portalAccessAudit.deleteMany({
    where: { targetUserId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function user(local, overrides = {}) {
  return prisma.user.create({
    data: {
      email: `${local}@${DOMAIN}`,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: 'USER',
      emailVerifiedAt: new Date(),
      onboardingStatus: 'COMPLETE',
      onboardingCompletedAt: new Date(),
      firstName: local.split('-')[0],
      lastName: 'Fixture',
      company: 'Lifecycle Fixtures',
      ...overrides,
    },
  });
}

async function request(owner, tier, status, extra = {}) {
  return prisma.accessRequest.create({
    data: {
      tier,
      fullName: `${owner.firstName} Fixture`,
      email: owner.email,
      organization: 'Lifecycle Fixtures',
      applicantRole: 'Researcher',
      intendedUse: 'Fixture data for lifecycle validation.',
      reason: 'Local development fixture only.',
      expectedUsers: 1,
      details:
        tier === 'RESEARCH'
          ? {
              department: 'Computer Science',
              country: 'Philippines',
              expectedDuration: '6_TO_12_MONTHS',
              willPublish: false,
            }
          : {
              website: 'lifecycle.test',
              deployment: 'Fixture deployment for local testing.',
              dataAccess: 'EXPORTS',
            },
      accuracyConfirmedAt: new Date(),
      portalUserId: owner.id,
      status,
      ...extra,
    },
  });
}

async function licensedWorkspace(owner, tier, name, license) {
  const organization = await prisma.portalOrganization.create({
    data: { name: `Lifecycle ${name}` },
  });
  const req = await request(owner, tier, 'ACTIVE', {
    activatedAt: license.validFrom,
    portalOrganizationId: organization.id,
    billingPeriod: 'ANNUAL',
    approvedAt: license.validFrom,
    agreementAcceptedAt: license.validFrom,
  });
  await prisma.license.create({
    data: {
      accessRequestId: req.id,
      organizationId: organization.id,
      tier,
      billingPeriod: 'ANNUAL',
      status: license.status,
      validFrom: license.validFrom,
      validUntil: license.validUntil,
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'OWNER' },
  });
  return organization;
}

async function seed() {
  const now = Date.now();
  const active = {
    status: 'ACTIVE',
    validFrom: new Date(now - 30 * DAY),
    validUntil: new Date(now + 335 * DAY),
  };

  await user('setup', {
    onboardingStatus: 'NOT_STARTED',
    onboardingCompletedAt: null,
    firstName: null,
    lastName: null,
    company: null,
  });
  await user('ready');
  await request(await user('pending'), 'RESEARCH', 'RECEIVED');
  await request(await user('declined'), 'ORGANIZATION', 'DECLINED', {
    declinedAt: new Date(now - 2 * DAY),
  });
  await request(await user('approved'), 'RESEARCH', 'APPROVED', {
    approvedAt: new Date(now - DAY),
  });
  await request(await user('payment'), 'ORGANIZATION', 'AGREEMENT_ACCEPTED', {
    approvedAt: new Date(now - 2 * DAY),
    agreementAcceptedAt: new Date(now - DAY),
    agreementVersion: '2026-09',
  });

  await licensedWorkspace(
    await user('research'),
    'RESEARCH',
    'Research Lab',
    active,
  );
  const orgA = await licensedWorkspace(
    await user('org-owner'),
    'ORGANIZATION',
    'Org A',
    active,
  );
  for (const [local, role] of [
    ['org-tier1', 'TIER_1'],
    ['org-tier2', 'TIER_2'],
  ]) {
    const member = await user(local);
    await prisma.organizationMembership.create({
      data: { organizationId: orgA.id, userId: member.id, role },
    });
  }
  await licensedWorkspace(
    await user('org-b-owner'),
    'ORGANIZATION',
    'Org B',
    active,
  );

  // Status still ACTIVE, validity window passed: the clock alone must expire it.
  await licensedWorkspace(
    await user('expired-research'),
    'RESEARCH',
    'Expired Research',
    {
      status: 'ACTIVE',
      validFrom: new Date(now - 395 * DAY),
      validUntil: new Date(now - 30 * DAY),
    },
  );
  await licensedWorkspace(
    await user('expired-org'),
    'ORGANIZATION',
    'Expired Org',
    {
      status: 'EXPIRED',
      validFrom: new Date(now - 400 * DAY),
      validUntil: new Date(now - 35 * DAY),
    },
  );
  await licensedWorkspace(
    await user('suspended-license'),
    'ORGANIZATION',
    'Past Due Org',
    {
      status: 'PAST_DUE',
      validFrom: new Date(now - 60 * DAY),
      validUntil: null,
    },
  );
  await user('suspended-account', {
    portalAccessStatus: 'SUSPENDED',
    portalAccessReason: 'Fixture suspension',
  });
  // Local reviewer for the admin portal. Provisioned here, never via an API.
  await user('admin', { role: 'ADMIN' });
}

try {
  await removeFixtures();
  if (!process.argv.includes('--remove')) {
    await seed();
    const count = await prisma.user.count({
      where: { email: { endsWith: `@${DOMAIN}` } },
    });
    console.log(`Seeded ${count} lifecycle fixture accounts (@${DOMAIN}).`);
  } else {
    console.log('Removed lifecycle fixtures.');
  }
} finally {
  await prisma.$disconnect();
}
