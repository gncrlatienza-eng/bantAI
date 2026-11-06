// Run only against a disposable migrated bantai_shield_* database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { AuditService } = require('../dist/src/audit/audit.service.js');
const {
  CampaignsService,
} = require('../dist/src/campaigns/campaigns.service.js');
const {
  CampaignReconciliationService,
} = require('../dist/src/campaigns/campaign-reconciliation.service.js');

const url = new URL(process.env.DATABASE_URL ?? '');
if (!url.pathname.startsWith('/bantai_shield_')) {
  throw new Error('Use a disposable bantai_shield_* database.');
}
const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const campaigns = new CampaignsService(prisma, audit);
const reconciliation = new CampaignReconciliationService(
  prisma,
  audit,
  campaigns,
);

try {
  const user = await prisma.user.create({
    data: {
      email: `campaign-fixture-${Date.now()}@example.test`,
      role: 'ADMIN',
      webRole: 'ADMIN',
    },
  });
  const source = await prisma.campaignCluster.create({
    data: {
      label: 'Source',
      urlDomains: ['source.example'],
      isActive: true,
      messageCount: 1,
      publishedAt: new Date(),
    },
  });
  const target = await prisma.campaignCluster.create({
    data: {
      label: 'Target',
      urlDomains: ['target.example'],
      isActive: true,
      messageCount: 2,
      publishedAt: new Date(),
    },
  });
  const message = await prisma.smsMessage.create({
    data: {
      userId: user.id,
      clusterId: source.id,
      campaignMatchSource: 'model',
      sender: 'hmac-fixture',
      body: '[BRAND] sent [URL]',
    },
  });
  const report = await prisma.userReport.create({
    data: {
      userId: user.id,
      messageId: message.id,
      originalLabel: 'Scam',
      reportedLabel: 'Spam',
      status: 'Validated',
    },
  });
  await prisma.shieldCampaignMessage.create({
    data: {
      campaignId: target.id,
      maskedText: '[BRAND] sent [URL]',
      approvedAt: new Date(),
      approvedByUserId: user.id,
    },
  });

  const evidence = [`report:${report.id}`];
  await assert.rejects(
    reconciliation.merge(
      target.id,
      {
        sourceId: source.id,
        expectedSourceRevision: 1,
        expectedTargetRevision: 0,
        reason: 'Validated report shows the same campaign pattern.',
        evidenceReferences: evidence,
      },
      user.id,
    ),
    /changed/,
  );
  assert.equal(
    (await prisma.smsMessage.findUnique({ where: { id: message.id } }))
      .clusterId,
    source.id,
  );

  const merged = await reconciliation.merge(
    target.id,
    {
      sourceId: source.id,
      expectedSourceRevision: 0,
      expectedTargetRevision: 0,
      reason: 'Validated report shows the same campaign pattern.',
      evidenceReferences: evidence,
    },
    user.id,
  );
  assert.equal(merged.reassignedMessages, 1);
  const afterMerge = await prisma.campaignCluster.findUnique({
    where: { id: target.id },
  });
  assert.equal(afterMerge.messageCount, 2); // historical count is not fabricated
  assert.equal(afterMerge.countVerified, false);
  assert.equal(afterMerge.publishedAt, null);
  assert.equal(
    (await prisma.campaignCluster.findUnique({ where: { id: source.id } }))
      .archivedAt !== null,
    true,
  );
  assert.equal(
    (await prisma.smsMessage.findUnique({ where: { id: message.id } }))
      .clusterId,
    target.id,
  );
  assert.equal(
    await prisma.shieldCampaignMessage.count({
      where: { campaignId: target.id, revokedAt: null },
    }),
    0,
  );

  const split = await reconciliation.split(
    target.id,
    {
      expectedRevision: 1,
      title: 'Reviewed child',
      messageIds: [message.id],
      domains: ['source.example'],
      reason: 'The reviewed indicators define a separate lure.',
      evidenceReferences: [`operation:${merged.operationId}`],
    },
    user.id,
  );
  const child = await prisma.campaignCluster.findUnique({
    where: { id: split.childId },
  });
  assert.equal(child.isActive, false);
  assert.equal(child.publishedAt, null);
  assert.equal(
    (await prisma.smsMessage.findUnique({ where: { id: message.id } }))
      .clusterId,
    child.id,
  );

  const corrected = await reconciliation.correctAssignment(
    {
      messageId: message.id,
      targetCampaignId: target.id,
      reason: 'Reviewed split assignment was an erroneous match.',
      evidenceReferences: [`operation:${split.operationId}`],
    },
    user.id,
  );
  assert.equal(
    (await prisma.smsMessage.findUnique({ where: { id: message.id } }))
      .clusterId,
    target.id,
  );
  assert.equal(
    await prisma.campaignAssignmentHistory.count({
      where: { messageId: message.id },
    }),
    3,
  );

  await prisma.campaignCluster.update({
    where: { id: target.id },
    data: {
      summary: 'Reviewed campaign pattern',
      risk: 'HIGH',
      category: 'Impersonation',
      mitigation: 'Ignore links and report the sender',
      publishedAt: new Date(),
    },
  });
  const draft = await reconciliation.draftEvolution(
    target.id,
    {
      type: 'CAMPAIGN_RELATION',
      summary: 'Reviewed evidence links related lure variants.',
      evidenceReferences: [`operation:${corrected.operationId}`],
    },
    user.id,
  );
  assert.equal(
    (await campaigns.findShieldTimeline(target.id)).events.length,
    0,
  );
  await reconciliation.approveEvolution(draft.id, user.id);
  const timeline = await campaigns.findShieldTimeline(target.id);
  assert.equal(timeline.events.length, 1);
  assert.equal(JSON.stringify(timeline).includes('evidenceReferences'), false);
  await reconciliation.correctAssignment(
    {
      messageId: message.id,
      targetCampaignId: child.id,
      reason: 'Further review places this message in the child campaign.',
      evidenceReferences: [`operation:${split.operationId}`],
    },
    user.id,
  );
  assert.equal(
    await prisma.campaignEvolutionEvent.count({
      where: { id: draft.id, revokedAt: null },
    }),
    0,
  );
  console.log(
    'Campaign merge, split, correction, provenance and approved timeline: passed',
  );
} finally {
  await prisma.$disconnect();
}
