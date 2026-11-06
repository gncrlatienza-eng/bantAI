import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response,
} from 'express';
import request from 'supertest';

import { PrismaService } from '../database/prisma.service';
import { PortalRoutePolicy } from '../src/access-control/portal-route.policy';
import { WorkspaceAccessService } from '../src/access-control/workspace-access.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AuthAudience } from '../src/auth/constants';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { CampaignsController } from '../src/campaigns/campaigns.controller';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { ClientAudienceGuard } from '../src/portal-organizations/client-audience.guard';
import { LicenseEntitlementGuard } from '../src/portal-organizations/license-entitlement.guard';
import { OrganizationScopeGuard } from '../src/portal-organizations/organization-scope.guard';
import { PortalOrganizationsController } from '../src/portal-organizations/portal-organizations.controller';
import { PortalOrganizationsService } from '../src/portal-organizations/portal-organizations.service';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';
import { SmsController } from '../src/sms/sms.controller';
import { SmsService } from '../src/sms/sms.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

/*
 * R1/R2 proof (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.7-A.8).
 *
 * Runs the real JwtAuthGuard → PortalRoutePolicy → WorkspaceAccessService and
 * the real organization guards. Only Passport token parsing is replaced: a
 * middleware sets req.user from "Bearer <audience>:<userId>", the shape
 * JwtStrategy.validate() produces. The Prisma mock evaluates the license
 * `where` clause the service sends, so removing the status/validity checks from
 * the query makes these tests fail.
 */

type LicenseRow = {
  id: string;
  tier: 'SHIELD';
  status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  validFrom: Date;
  validUntil: Date | null;
};
type OrgRow = {
  id: string;
  name: string;
  isActive: boolean;
  licenses: LicenseRow[];
};
type MembershipRow = {
  userId: string;
  organizationId: string;
  role: 'SHIELD';
  createdAt: Date;
};

const DAY = 86_400_000;
const past = () => new Date(Date.now() - 30 * DAY);
const future = () => new Date(Date.now() + 30 * DAY);

function license(
  id: string,
  tier: LicenseRow['tier'],
  status: LicenseRow['status'] = 'ACTIVE',
  validUntil: Date | null = future(),
): LicenseRow {
  return { id, tier, status, validFrom: past(), validUntil };
}

const organizations: OrgRow[] = [
  {
    id: 'org-research',
    name: 'Research Lab',
    isActive: true,
    licenses: [license('lic-r', 'SHIELD')],
  },
  {
    id: 'org-a',
    name: 'Org A',
    isActive: true,
    licenses: [license('lic-a', 'SHIELD')],
  },
  {
    id: 'org-b',
    name: 'Org B',
    isActive: true,
    licenses: [license('lic-b', 'SHIELD')],
  },
  // Status still ACTIVE but the validity window has passed — the case a
  // missed Stripe webhook leaves behind. The clock alone must deny it.
  {
    id: 'org-clock-expired',
    name: 'Clock Expired',
    isActive: true,
    licenses: [
      license('lic-ce', 'SHIELD', 'ACTIVE', new Date(Date.now() - DAY)),
    ],
  },
  {
    id: 'org-expired',
    name: 'Expired',
    isActive: true,
    licenses: [license('lic-e', 'SHIELD', 'EXPIRED', past())],
  },
  {
    id: 'org-cancelled',
    name: 'Cancelled',
    isActive: true,
    licenses: [license('lic-c', 'SHIELD', 'CANCELLED')],
  },
  {
    id: 'org-suspended-license',
    name: 'Suspended License',
    isActive: true,
    licenses: [license('lic-s', 'SHIELD', 'SUSPENDED')],
  },
  {
    id: 'org-past-due',
    name: 'Past Due',
    isActive: true,
    licenses: [license('lic-pd', 'SHIELD', 'PAST_DUE')],
  },
  {
    id: 'org-inactive',
    name: 'Deactivated Workspace',
    isActive: false,
    licenses: [license('lic-i', 'SHIELD')],
  },
];

const memberships: MembershipRow[] = [
  ['research-owner', 'org-research', 'SHIELD'],
  ['research-tier2', 'org-research', 'SHIELD'],
  ['org-a-owner', 'org-a', 'SHIELD'],
  ['org-a-tier1', 'org-a', 'SHIELD'],
  ['org-a-tier2', 'org-a', 'SHIELD'],
  ['org-b-owner', 'org-b', 'SHIELD'],
  ['clock-expired-owner', 'org-clock-expired', 'SHIELD'],
  ['expired-owner', 'org-expired', 'SHIELD'],
  ['cancelled-owner', 'org-cancelled', 'SHIELD'],
  ['license-suspended-owner', 'org-suspended-license', 'SHIELD'],
  ['past-due-owner', 'org-past-due', 'SHIELD'],
  ['inactive-workspace-owner', 'org-inactive', 'SHIELD'],
].map(([userId, organizationId, role], index) => ({
  userId,
  organizationId,
  role: role as MembershipRow['role'],
  createdAt: new Date(2026, 0, index + 1),
}));
// 'pending-applicant' and 'declined-applicant' deliberately have no
// memberships: an application alone never grants a workspace.

type Where = Record<string, unknown>;
function matchesLicense(row: LicenseRow, where?: Where): boolean {
  if (!where) return true;
  if (where.status !== undefined && row.status !== where.status) return false;
  const validFrom = where.validFrom as { lte?: Date } | undefined;
  if (validFrom?.lte && !(row.validFrom <= validFrom.lte)) return false;
  if ('validUntil' in where) {
    const clause = where.validUntil as { gt?: Date } | null;
    if (clause === null) {
      if (row.validUntil !== null) return false;
    } else if (clause?.gt) {
      if (!(row.validUntil && row.validUntil > clause.gt)) return false;
    }
  }
  if (Array.isArray(where.OR)) {
    return (where.OR as Where[]).some((branch) => matchesLicense(row, branch));
  }
  return true;
}

function project(membership: MembershipRow, licenseWhere?: Where) {
  const organization = organizations.find(
    (org) => org.id === membership.organizationId,
  )!;
  return {
    role: membership.role,
    organization: {
      id: organization.id,
      name: organization.name,
      isActive: organization.isActive,
      licenses: organization.licenses
        .filter((row) => matchesLicense(row, licenseWhere))
        .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())
        .slice(0, 1)
        .map(({ id, tier, validUntil }) => ({ id, tier, validUntil })),
    },
  };
}

type MembershipQuery = {
  where: {
    userId?: string;
    organizationId?: string;
    organizationId_userId?: { organizationId: string; userId: string };
    organization?: { isActive?: boolean };
  };
  select: {
    organization: { select: { licenses: { where?: Where } } };
  };
};

const prisma = {
  organizationMembership: {
    findMany: jest.fn((query: MembershipQuery) => {
      const { where } = query;
      const licenseWhere = query.select.organization.select.licenses.where;
      return Promise.resolve(
        memberships
          .filter(
            (row) =>
              row.userId === where.userId &&
              (!where.organizationId ||
                row.organizationId === where.organizationId) &&
              (where.organization?.isActive === undefined ||
                organizations.find((org) => org.id === row.organizationId)
                  ?.isActive === where.organization.isActive),
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((row) => project(row, licenseWhere)),
      );
    }),
    findUnique: jest.fn((query: MembershipQuery) => {
      const key = query.where.organizationId_userId!;
      const row = memberships.find(
        (membership) =>
          membership.userId === key.userId &&
          membership.organizationId === key.organizationId,
      );
      return Promise.resolve(
        row
          ? project(row, query.select.organization.select.licenses.where)
          : null,
      );
    }),
  },
};

const ok = { ok: true };
const safeCampaign = {
  id: 'c1',
  title: 'Verified lure',
  summary: 'Brand impersonation',
  status: 'ACTIVE',
  urlDomains: ['example[.]test'],
};
const campaigns = {
  findAll: jest.fn().mockResolvedValue([ok]),
  findShieldAll: jest.fn().mockResolvedValue([safeCampaign]),
  findShieldOne: jest.fn().mockResolvedValue(safeCampaign),
  findShieldMaskedMessages: jest
    .fn()
    .mockResolvedValue([
      { text: '[BRAND]: Verify [ACCOUNT] at [URL].', campaignId: 'c1' },
    ]),
  findAdminOne: jest.fn().mockResolvedValue(ok),
  updateIntelligence: jest.fn().mockResolvedValue(ok),
  approveMaskedMessage: jest.fn().mockResolvedValue(ok),
  publish: jest.fn().mockResolvedValue(safeCampaign),
  createAdmin: jest.fn().mockResolvedValue({
    id: 'draft-1',
    isActive: false,
    publishedAt: null,
  }),
  setIndicators: jest.fn().mockResolvedValue({
    id: 'c1',
    urlDomains: ['example.test'],
    publishedAt: null,
  }),
  reactivate: jest.fn().mockResolvedValue({ id: 'c1', isActive: true }),
  archive: jest.fn().mockResolvedValue({ id: 'c1', isActive: false }),
  findArchived: jest.fn().mockResolvedValue([]),
  findAllInactive: jest.fn().mockResolvedValue([ok]),
  findOne: jest.fn().mockResolvedValue(ok),
  findAllCentroids: jest.fn(),
  create: jest.fn(),
  addDomains: jest.fn(),
  deactivate: jest.fn(),
};
const sms = {
  ingest: jest.fn().mockResolvedValue(ok),
  getAlerts: jest.fn().mockResolvedValue([ok]),
  getIndicators: jest.fn().mockResolvedValue({ indicators: [] }),
  storeIndicators: jest.fn(),
};
const reports = {
  submit: jest.fn().mockResolvedValue(ok),
  findAll: jest.fn().mockResolvedValue([ok]),
  findPending: jest.fn().mockResolvedValue([ok]),
  validate: jest.fn(),
  reject: jest.fn(),
};
const users = {
  updateMe: jest.fn().mockResolvedValue(ok),
  deleteMe: jest.fn().mockResolvedValue(undefined),
};
const auth = { getMe: jest.fn().mockResolvedValue({ id: 'me' }) };
const portalOrganizations = {
  scopedAlertSummary: jest.fn().mockResolvedValue([ok]),
  listForUser: jest.fn().mockResolvedValue([]),
  entitlements: jest.fn().mockResolvedValue(ok),
  exportMaskedAlerts: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  list: jest.fn(),
  addMember: jest.fn(),
};

function sessionFromHeader(
  req: ExpressRequest & { user?: unknown },
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const [audience, userId] = header.slice('Bearer '.length).split(':');
    req.user = {
      userId,
      role: audience === 'admin' ? 'ADMIN' : 'USER',
      webRole:
        audience === 'admin'
          ? 'ADMIN'
          : audience === 'client'
            ? 'SHIELD'
            : null,
      audience:
        audience === 'admin'
          ? AuthAudience.ADMIN
          : audience === 'mobile'
            ? AuthAudience.MOBILE
            : AuthAudience.CLIENT,
    };
  }
  next();
}

describe('portal entitlement and member capability enforcement (e2e)', () => {
  let app: INestApplication;
  const client = (userId: string) => `Bearer client:${userId}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        CampaignsController,
        SmsController,
        ReportsController,
        UsersController,
        PortalOrganizationsController,
      ],
      providers: [
        PortalRoutePolicy,
        WorkspaceAccessService,
        AdminGuard,
        ClientAudienceGuard,
        OrganizationScopeGuard,
        LicenseEntitlementGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: CampaignsService, useValue: campaigns },
        { provide: SmsService, useValue: sms },
        { provide: ReportsService, useValue: reports },
        { provide: UsersService, useValue: users },
        { provide: PortalOrganizationsService, useValue: portalOrganizations },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(sessionFromHeader);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  const http = () => request(app.getHttpServer());

  describe('R1 — authenticated ≠ licensed', () => {
    const unlicensed: Array<[string, string]> = [
      ['pending applicant (no workspace)', 'pending-applicant'],
      ['declined applicant (no workspace)', 'declined-applicant'],
      ['license past validUntil, status still ACTIVE', 'clock-expired-owner'],
      ['license EXPIRED', 'expired-owner'],
      ['license CANCELLED', 'cancelled-owner'],
      ['license SUSPENDED', 'license-suspended-owner'],
      ['license PAST_DUE', 'past-due-owner'],
      ['deactivated workspace', 'inactive-workspace-owner'],
    ];

    it.each(unlicensed)(
      '%s cannot read campaigns, alerts, or submit reports',
      async (_label, userId) => {
        for (const path of [
          '/api/campaigns',
          '/api/campaigns/inactive',
          '/api/campaigns/c1',
          '/api/sms/alerts',
          '/api/sms/m1/indicators',
        ]) {
          const res = await http()
            .get(path)
            .set('Authorization', client(userId))
            .expect(403);
          expect(res.body.code).toBe('LICENSE_INACTIVE');
        }
        const report = await http()
          .post('/api/reports')
          .set('Authorization', client(userId))
          .send({})
          .expect(403);
        expect(report.body.code).toBe('LICENSE_INACTIVE');
      },
    );

    it.each(unlicensed)(
      '%s cannot read its former workspace and retired dataset routes are unavailable',
      async (_label, userId) => {
        const organizationId =
          memberships.find((row) => row.userId === userId)?.organizationId ??
          'org-a';
        await http()
          .get(`/api/portal-organizations/${organizationId}/entitlements`)
          .set('Authorization', client(userId))
          .expect(403);
        for (const path of [
          `/api/portal-organizations/${organizationId}/export?format=json&limit=10`,
          `/api/portal-organizations/${organizationId}/alerts`,
        ]) {
          await http()
            .get(path)
            .set('Authorization', client(userId))
            .expect(404);
        }
      },
    );

    it.each(unlicensed)(
      '%s keeps account routes (session stays valid)',
      async (_label, userId) => {
        await http()
          .get('/api/auth/me')
          .set('Authorization', client(userId))
          .expect(200);
        await http()
          .put('/api/users/me')
          .set('Authorization', client(userId))
          .send({ firstName: 'Ana' })
          .expect(200);
        await http()
          .get('/api/portal-organizations/mine')
          .set('Authorization', client(userId))
          .expect(200);
      },
    );

    it('active Shield members read published campaigns but not SMS alerts', async () => {
      for (const userId of ['research-owner', 'org-a-owner', 'org-b-owner']) {
        await http()
          .get('/api/campaigns')
          .set('Authorization', client(userId))
          .expect(200);
        await http()
          .get('/api/sms/alerts')
          .set('Authorization', client(userId))
          .expect(403);
      }
      await http()
        .get('/api/campaigns/c1/export')
        .set('Authorization', client('org-a-owner'))
        .expect(200);
    });

    it('client sessions are denied routes that declare no portal rule', async () => {
      const ingest = await http()
        .post('/api/sms/ingest')
        .set('Authorization', client('org-a-owner'))
        .send({})
        .expect(403);
      expect(ingest.body.code).toBe('PORTAL_ROUTE_NOT_ALLOWED');
      await http()
        .delete('/api/users/me')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
    });

    it('mobile sessions are unaffected by the portal policy', async () => {
      await http()
        .get('/api/campaigns')
        .set('Authorization', 'Bearer mobile:phone-user')
        .expect(200);
      await http()
        .post('/api/sms/ingest')
        .set('Authorization', 'Bearer mobile:phone-user')
        .send({})
        .expect(201);
      await http()
        .delete('/api/users/me')
        .set('Authorization', 'Bearer mobile:phone-user')
        .expect(204);
    });

    it('admin sessions keep working and client sessions cannot reach admin routes', async () => {
      await http()
        .get('/api/reports')
        .set('Authorization', 'Bearer admin:admin-1')
        .expect(200);
      await http()
        .get('/api/campaigns')
        .set('Authorization', 'Bearer admin:admin-1')
        .expect(200);
      await http()
        .get('/api/reports')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
    });

    it('unauthenticated requests are rejected', async () => {
      await http().get('/api/campaigns').expect(401);
    });

    it('returns the same safe campaign shape for Shield detail and export', async () => {
      const authorization = client('org-a-owner');
      const detail = await http()
        .get('/api/campaigns/c1')
        .set('Authorization', authorization)
        .expect(200);
      const exported = await http()
        .get('/api/campaigns/c1/export')
        .set('Authorization', authorization)
        .expect(200);
      expect(detail.body).toEqual(safeCampaign);
      expect(exported.body).toEqual(safeCampaign);
      expect(JSON.stringify(exported.body)).not.toMatch(
        /body|sender|phone|device|centroid|messages/i,
      );
    });

    it('exposes only reviewed masked examples through the dedicated route', async () => {
      const result = await http()
        .get('/api/campaigns/c1/masked-messages')
        .set('Authorization', client('org-a-owner'))
        .expect(200);
      expect(result.body).toEqual([
        { text: '[BRAND]: Verify [ACCOUNT] at [URL].', campaignId: 'c1' },
      ]);
    });

    it('denies Shield writes and obsolete or restricted data routes', async () => {
      const authorization = client('org-a-owner');
      await http()
        .patch('/api/campaigns/c1/intelligence')
        .set('Authorization', authorization)
        .send({ title: 'Tamper' })
        .expect(403);
      await http()
        .get('/api/reports')
        .set('Authorization', authorization)
        .expect(403);
      await http()
        .get('/api/sms/alerts')
        .set('Authorization', authorization)
        .expect(403);
      await http()
        .get('/api/portal-organizations/org-a/export')
        .set('Authorization', authorization)
        .expect(404);
    });

    it('lets Admin edit campaign intelligence while denying a legacy web identity', async () => {
      await http()
        .patch('/api/campaigns/c1/intelligence')
        .set('Authorization', 'Bearer admin:admin-1')
        .send({ title: 'Reviewed' })
        .expect(200);
      await http()
        .get('/api/campaigns')
        .set('Authorization', 'Bearer legacy:old-user')
        .expect(403);
    });

    it('allows Admin campaign creation and indicator management but denies Shield writes', async () => {
      const draft = {
        title: 'Reviewed campaign',
        summary: 'Account impersonation pattern',
        risk: 'HIGH',
        category: 'Impersonation',
        mitigation: 'Block verified indicators',
      };
      await http()
        .post('/api/campaigns/admin')
        .set('Authorization', client('org-a-owner'))
        .send(draft)
        .expect(403);
      await http()
        .put('/api/campaigns/c1/indicators')
        .set('Authorization', client('org-a-owner'))
        .send({ domains: ['example.test'] })
        .expect(403);
      await http()
        .patch('/api/campaigns/c1/reactivate')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
      await http()
        .patch('/api/campaigns/c1/archive')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
      await http()
        .get('/api/campaigns/admin/archived')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
      await http()
        .post('/api/campaigns/admin')
        .set('Authorization', 'Bearer admin:admin-1')
        .send(draft)
        .expect(201);
      await http()
        .put('/api/campaigns/c1/indicators')
        .set('Authorization', 'Bearer admin:admin-1')
        .send({ domains: ['example.test'] })
        .expect(200);
      await http()
        .patch('/api/campaigns/c1/reactivate')
        .set('Authorization', 'Bearer admin:admin-1')
        .expect(200);
      await http()
        .patch('/api/campaigns/c1/archive')
        .set('Authorization', 'Bearer admin:admin-1')
        .expect(200);
      await http()
        .get('/api/campaigns/admin/archived')
        .set('Authorization', 'Bearer admin:admin-1')
        .expect(200);
      expect(campaigns.createAdmin).toHaveBeenCalledWith(draft, 'admin-1');
      expect(campaigns.setIndicators).toHaveBeenCalledWith(
        'c1',
        { domains: ['example.test'] },
        'admin-1',
      );
      expect(campaigns.reactivate).toHaveBeenCalledWith('c1', 'admin-1');
      expect(campaigns.archive).toHaveBeenCalledWith('c1', 'admin-1');
    });
  });

  describe('single Shield member capability', () => {
    it('every Shield member reads published intelligence and exports one campaign', async () => {
      await http()
        .get('/api/campaigns')
        .set('Authorization', client('org-a-tier2'))
        .expect(200);
      await http()
        .get('/api/campaigns/c1/export')
        .set('Authorization', client('org-a-tier2'))
        .expect(200);
      await http()
        .get('/api/sms/alerts')
        .set('Authorization', client('org-a-tier2'))
        .expect(403);
    });
  });

  describe('tenant isolation', () => {
    it('Organization A cannot reach Organization B by changing the path', async () => {
      const res = await http()
        .get('/api/portal-organizations/org-b/entitlements')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
      expect(res.body.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('an unknown organization id is indistinguishable from a foreign one', async () => {
      const res = await http()
        .get('/api/portal-organizations/does-not-exist/entitlements')
        .set('Authorization', client('org-a-owner'))
        .expect(403);
      expect(res.body.code).toBe('WORKSPACE_ACCESS_DENIED');
    });
  });
});
