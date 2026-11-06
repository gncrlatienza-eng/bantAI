// Read-only acceptance against the local migrated bantai_db and running backend.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
for (const line of readFileSync(
  fileURLToPath(new URL('../.env', import.meta.url)),
  'utf8',
).split(/\r?\n/)) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
}
const { PrismaClient } = require('@prisma/client');
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
if (databaseUrl.pathname !== '/bantai_db')
  throw new Error('Expected local bantai_db.');
const prisma = new PrismaClient();

function jwt(userId, audience) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: userId,
    aud: audience,
    iss: process.env.JWT_ISSUER?.trim() || 'bantai-api',
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const secret =
    audience === 'bantai-admin-api'
      ? process.env.ADMIN_JWT_SECRET?.trim() || process.env.JWT_SECRET
      : process.env.CLIENT_JWT_SECRET?.trim() || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT signing configuration is missing.');
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

try {
  const licenseCounts = await prisma.license.groupBy({
    by: ['legacyTier', 'shieldReviewDecision'],
    _count: { _all: true },
  });
  assert.equal(
    licenseCounts.reduce((sum, item) => sum + item._count._all, 0),
    8,
  );
  assert.equal(
    licenseCounts.every(
      (item) => item.legacyTier && item.shieldReviewDecision === 'PENDING',
    ),
    true,
  );
  const approved = await prisma.license.count({
    where: { shieldApprovedAt: { not: null } },
  });
  assert.equal(approved, 0);
  const legacy = await prisma.license.findFirst({
    where: {
      legacyTier: { not: null },
      organization: { members: { some: { user: { webRole: 'SHIELD' } } } },
    },
    select: {
      organization: {
        select: {
          members: {
            where: { user: { webRole: 'SHIELD' } },
            take: 1,
            select: { userId: true },
          },
        },
      },
    },
  });
  assert.ok(
    legacy?.organization.members[0],
    'Expected a historical Shield portal member.',
  );
  const clientToken = jwt(
    legacy.organization.members[0].userId,
    'bantai-client-api',
  );
  let response = await fetch('http://127.0.0.1:3000/api/account/state', {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.state, 'LEGACY_REVIEW_REQUIRED');
  response = await fetch('http://127.0.0.1:3000/api/campaigns', {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  assert.ok([401, 403].includes(response.status));
  const admin = await prisma.user.findFirst({
    where: { webRole: 'ADMIN', role: 'ADMIN' },
    select: { id: true },
  });
  assert.ok(admin, 'Expected a current Admin.');
  response = await fetch(
    'http://127.0.0.1:3000/api/admin/portal-accounts/licenses/legacy-review',
    {
      headers: { Authorization: `Bearer ${jwt(admin.id, 'bantai-admin-api')}` },
    },
  );
  assert.equal(response.status, 200);
  const reviews = await response.json();
  assert.equal(reviews.length, 8);
  console.log(
    'Live local DB: eight historical licenses pending, no Shield approvals, customer denied, Admin review list available',
  );
} finally {
  await prisma.$disconnect();
}
