/*
 * Provisions a staff role for an existing admin account.
 *
 *   node --env-file=.env scripts/grant-staff-role.mjs --list
 *   node --env-file=.env scripts/grant-staff-role.mjs <email> <ROLE>           # dry run
 *   node --env-file=.env scripts/grant-staff-role.mjs <email> <ROLE> --apply   # write
 *
 * Staff permissions are fail-closed: an ADMIN whose staffRole is null resolves
 * to no permissions (auth/constants/staff-permissions.ts), and nothing in the
 * API assigns a staff role. The staff-roles migration added the column without
 * a backfill, so every admin created before it (or since) has to be given one
 * explicitly. This is deliberately a one-account, explicit-role command rather
 * than a migration that grants SUPERADMIN to every existing admin.
 *
 * Only accounts that are already role=ADMIN and webRole=ADMIN can be changed.
 * Each change is recorded as an ADMIN_ROLE_CHANGED audit event.
 */
import { PrismaClient } from '@prisma/client';

const ROLES = ['SUPERADMIN', 'SUPPORT', 'ANALYST', 'OPERATIONS', 'PRIVACY'];

function usage(message) {
  if (message) console.error(message);
  console.error(
    'Usage: grant-staff-role.mjs --list | <email> <' +
      ROLES.join('|') +
      '> [--apply]',
  );
  process.exit(1);
}

function databaseHost() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return '(DATABASE_URL not set)';
  }
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const positional = args.filter((arg) => !arg.startsWith('--'));
const prisma = new PrismaClient();

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, webRole: true, staffRole: true },
    orderBy: { email: 'asc' },
  });
  if (admins.length === 0) {
    console.log('No ADMIN accounts.');
    return;
  }
  for (const admin of admins) {
    console.log(
      `${admin.email ?? '(no email)'}  webRole=${admin.webRole ?? 'null'}  staffRole=${admin.staffRole ?? 'null'}`,
    );
  }
}

async function grant(email, staffRole) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      webRole: true,
      staffRole: true,
    },
  });
  if (!user) usage(`No account with email ${email}.`);
  if (user.role !== 'ADMIN' || user.webRole !== 'ADMIN') {
    usage(
      `${email} is role=${user.role}, webRole=${user.webRole ?? 'null'}. ` +
        'Only an existing admin account can be given a staff role.',
    );
  }
  if (user.staffRole === staffRole) {
    console.log(`${email} already has staffRole=${staffRole}. Nothing to do.`);
    return;
  }

  console.log(
    `${email}: staffRole ${user.staffRole ?? 'null'} -> ${staffRole}`,
  );
  if (!apply) {
    console.log('Dry run. Re-run with --apply to write the change.');
    return;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { staffRole } }),
    prisma.auditEvent.create({
      data: {
        type: 'ADMIN_ROLE_CHANGED',
        targetUserId: user.id,
        metadata: {
          field: 'staffRole',
          previous: user.staffRole,
          next: staffRole,
          via: 'scripts/grant-staff-role.mjs',
        },
      },
    }),
  ]);
  // Permissions are resolved from the database on every request
  // (jwt.strategy.ts), so the account does not need to sign in again.
  console.log('Applied. Takes effect on the next request; no re-login needed.');
}

console.log(`Database: ${databaseHost()}`);
try {
  if (args.includes('--list')) {
    await listAdmins();
  } else {
    const [email, rawRole] = positional;
    if (!email || !rawRole) usage();
    const staffRole = rawRole.toUpperCase();
    if (!ROLES.includes(staffRole)) usage(`Unknown staff role: ${rawRole}`);
    await grant(email.trim().toLowerCase(), staffRole);
  }
} catch (error) {
  // P2022: the database predates the staff-roles migration
  // (20260924000000_add_workspace_and_staff_roles).
  if (error?.code === 'P2022') {
    console.error(
      'This database has no User.staffRole column yet. Run `npx prisma migrate deploy` first.',
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await prisma.$disconnect();
}
