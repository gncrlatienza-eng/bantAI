const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const prisma = new PrismaClient();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const passwordHash = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;
assert.equal(email, 'reymarkdecastro59@gmail.com', 'This one-time bootstrap is bound to the operator-approved email');
assert.match(passwordHash || '', /^\$2[aby]\$12\$/);
(async () => {
  try {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        assert.equal(existing.role, 'ADMIN', 'Existing non-admin requires explicit review');
        assert.equal(existing.webRole, 'ADMIN');
        assert.equal(existing.staffRole, 'SUPERADMIN');
        assert.equal(existing.passwordHash, passwordHash, 'Never replace an existing credential');
        return { id: existing.id, created: false };
      }
      assert.equal(await tx.user.count({ where: { role: 'ADMIN' } }), 0, 'Only first-administrator bootstrap is supported');
      const user = await tx.user.create({ data: {
        email, passwordHash, role: 'ADMIN', webRole: 'ADMIN', staffRole: 'SUPERADMIN',
        firstName: 'Reymark', lastName: 'De Castro', portalAccessStatus: 'ACTIVE',
      } });
      await tx.auditEvent.create({ data: {
        type: 'ADMIN_ROLE_CHANGED', targetUserId: user.id,
        metadata: { via: 'operator-approved-first-admin-bootstrap', email, next: 'SUPERADMIN', emailOwnershipVerified: false },
      } });
      return { id: user.id, created: true };
    }, { isolationLevel: 'Serializable' });
    console.log(JSON.stringify({ adminBootstrap: 'succeeded', email, ...result, emailOtpRequired: true }));
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
