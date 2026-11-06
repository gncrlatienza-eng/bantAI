import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType, DatasetSplit, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { maskSmsBody } from '../sms/sms-privacy-masker';
import { CreateDatasetSnapshotDto } from './dto/create-dataset-snapshot.dto';
import { CurateReportDto } from './dto/curate-report.dto';
import { ConfirmCandidateDto, type ReviewKind } from './dto/review-queue.dto';
import { UpdateDatasetSampleDto } from './dto/update-dataset-sample.dto';

const TRAINING_LABELS = ['Ham', 'Spam', 'Scam'] as const;

/** Most candidates one queue request returns. */
const REVIEW_QUEUE_LIMIT = 50;
/** Recent safe messages a spot-check samples from at random. */
const SPOT_CHECK_POOL = 500;

// A message is a review candidate only if it was classified by the server's
// model (trusted), its owner opted in to training, nobody reported it (reports
// have their own path), it isn't already a sample, and it wasn't skipped.
// Consent time is checked per row (see consented()).
const REVIEW_CANDIDATE_WHERE = {
  trusted: true,
  reviewDismissedAt: null,
  datasetSample: { is: null },
  reports: { none: {} },
  user: { trainingOptIn: true },
} satisfies Prisma.SmsMessageWhereInput;

const REVIEW_CLASSIFICATION: Record<
  ReviewKind,
  Prisma.ClassificationWhereInput
> = {
  detected: { label: 'Scam' },
  uncertain: { bucket: 'unknown' },
  spot_check: { label: 'Ham', bucket: 'safe' },
};

/** One message offered to an admin for labelling. Masked text only. */
export interface ReviewCandidate {
  messageId: string;
  kind: ReviewKind;
  maskedText: string;
  label: string | null;
  score: number | null;
  bucket: string | null;
  clusterId: string | null;
  receivedAt: Date;
}

/** Ingested by the server after the owner opted in -- never before. */
function consented(message: {
  createdAt: Date;
  user: { trainingOptInAt: Date | null };
}): boolean {
  const optedInAt = message.user.trainingOptInAt;
  return optedInAt !== null && message.createdAt >= optedInAt;
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SAMPLE_SELECT = {
  id: true,
  sourceReportId: true,
  sourceMessageId: true,
  maskedText: true,
  label: true,
  language: true,
  split: true,
  included: true,
  provenance: true,
  consentConfirmed: true,
  reviewedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SNAPSHOT_SELECT = {
  id: true,
  versionTag: true,
  createdAt: true,
  createdByUserId: true,
  _count: { select: { items: true } },
} as const;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Curated training data. Only masked text from Admin-validated user reports
 * enters it (re-masked with the server's canonical masker at every entry and
 * exit, never trusted from the phone), labels stay
 * within the classifier's Ham/Spam/Scam classes, every change is a new
 * immutable revision, and snapshots freeze exactly what a training run used.
 * The frozen HOLDOUT split is never created or edited here.
 */
@Injectable()
export class DatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async overview() {
    const [samples, pendingValidatedReports, snapshots, frozenHoldoutCount] =
      await Promise.all([
        this.prisma.datasetSample.findMany({
          where: { split: DatasetSplit.TRAIN },
          orderBy: { updatedAt: 'desc' },
          take: 500,
          select: SAMPLE_SELECT,
        }),
        this.prisma.userReport.findMany({
          where: { status: 'Validated', datasetSample: null },
          orderBy: { validatedAt: 'asc' },
          take: 100,
          select: {
            id: true,
            originalLabel: true,
            reportedLabel: true,
            validatedAt: true,
            message: { select: { body: true } },
          },
        }),
        this.prisma.datasetSnapshot.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: SNAPSHOT_SELECT,
        }),
        this.prisma.datasetSample.count({
          where: { split: DatasetSplit.HOLDOUT },
        }),
      ]);

    const labels: Record<string, number> = { Ham: 0, Spam: 0, Scam: 0 };
    const languages: Record<string, number> = {};
    for (const sample of samples) {
      if (!sample.included) continue;
      if (sample.label in labels) labels[sample.label] += 1;
      const language = sample.language ?? 'untagged';
      languages[language] = (languages[language] ?? 0) + 1;
    }

    return {
      samples,
      candidates: pendingValidatedReports.map((report) => ({
        id: report.id,
        label: report.reportedLabel,
        originalLabel: report.originalLabel,
        maskedText: maskSmsBody(report.message.body),
        validatedAt: report.validatedAt,
      })),
      snapshots: snapshots.map(({ _count, ...snapshot }) => ({
        ...snapshot,
        itemCount: _count.items,
      })),
      totals: {
        included: samples.filter((sample) => sample.included).length,
        excluded: samples.filter((sample) => !sample.included).length,
        candidates: pendingValidatedReports.length,
        frozenHoldout: frozenHoldoutCount,
        labels,
        languages,
      },
    };
  }

  async curateValidatedReport(
    reportId: string,
    dto: CurateReportDto,
    actorUserId: string,
  ) {
    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        reportedLabel: true,
        message: { select: { body: true } },
      },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);
    if (report.status !== 'Validated') {
      throw new BadRequestException(
        'Only validated user reports can enter the training dataset.',
      );
    }
    const label = dto.label ?? report.reportedLabel;
    if (!(TRAINING_LABELS as readonly string[]).includes(label)) {
      throw new BadRequestException(
        'Training label must be Ham, Spam, or Scam.',
      );
    }
    // Rows ingested before server-side masking may hold a client's unmasked
    // body, so training text is re-masked here rather than trusted.
    const maskedText = maskSmsBody(report.message.body);
    if (!maskedText) {
      throw new BadRequestException('The validated report has no masked text.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sample = await tx.datasetSample.create({
          data: {
            sourceReportId: report.id,
            maskedText,
            label,
            language: dto.language ?? null,
            split: DatasetSplit.TRAIN,
            included: true,
            provenance: 'validated_user_report',
            consentConfirmed: true,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
          },
          select: SAMPLE_SELECT,
        });
        await tx.datasetSampleRevision.create({
          data: {
            sampleId: sample.id,
            version: 1,
            action: 'CURATED',
            maskedText: sample.maskedText,
            label: sample.label,
            language: sample.language,
            included: true,
            actorUserId,
          },
        });
        await this.audit.record(
          {
            type: AuditEventType.DATASET_SAMPLE_CURATED,
            actorUserId,
            metadata: { sampleId: sample.id, reportId },
          },
          tx,
        );
        return sample;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('This report is already curated.');
      }
      throw error;
    }
  }

  /**
   * Candidates for an admin to label. Masked text only (re-masked here), never
   * the sender. Detected scams collapse to one per campaign or identical text,
   * so a blast doesn't flood the queue; spot-checks are a random draw.
   */
  async reviewQueue(kind: ReviewKind) {
    const rows = await this.prisma.smsMessage.findMany({
      where: {
        ...REVIEW_CANDIDATE_WHERE,
        classification: { is: REVIEW_CLASSIFICATION[kind] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: kind === 'spot_check' ? SPOT_CHECK_POOL : REVIEW_QUEUE_LIMIT * 4,
      select: {
        id: true,
        body: true,
        clusterId: true,
        receivedAt: true,
        createdAt: true,
        user: { select: { trainingOptInAt: true } },
        classification: { select: { label: true, score: true, bucket: true } },
      },
    });
    const pool = rows.filter(consented);
    const seen = new Set<string>();
    const candidates: ReviewCandidate[] = [];
    for (const row of kind === 'spot_check' ? shuffled(pool) : pool) {
      const maskedText = maskSmsBody(row.body);
      if (!maskedText) continue;
      const campaign = row.clusterId ? `campaign:${row.clusterId}` : null;
      if (seen.has(`text:${maskedText}`) || (campaign && seen.has(campaign))) {
        continue;
      }
      seen.add(`text:${maskedText}`);
      if (campaign) seen.add(campaign);
      candidates.push({
        messageId: row.id,
        kind,
        maskedText,
        label: row.classification?.label ?? null,
        score: row.classification?.score ?? null,
        bucket: row.classification?.bucket ?? null,
        clusterId: row.clusterId,
        receivedAt: row.receivedAt,
      });
      if (candidates.length >= REVIEW_QUEUE_LIMIT) break;
    }
    return candidates;
  }

  /** An admin's label for a queued message becomes a training sample. */
  async confirmCandidate(
    messageId: string,
    dto: ConfirmCandidateDto,
    actorUserId: string,
  ) {
    const message = await this.prisma.smsMessage.findFirst({
      where: { id: messageId, ...REVIEW_CANDIDATE_WHERE },
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { trainingOptInAt: true } },
      },
    });
    if (!message || !consented(message)) {
      throw new NotFoundException('This message is not a review candidate.');
    }
    const maskedText = maskSmsBody(message.body);
    if (!maskedText) {
      throw new BadRequestException('The message has no masked text.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sample = await tx.datasetSample.create({
          data: {
            sourceMessageId: message.id,
            maskedText,
            label: dto.label,
            language: dto.language ?? null,
            split: DatasetSplit.TRAIN,
            included: true,
            provenance: 'reviewed_detection',
            consentConfirmed: true,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
          },
          select: SAMPLE_SELECT,
        });
        await tx.datasetSampleRevision.create({
          data: {
            sampleId: sample.id,
            version: 1,
            action: 'CURATED',
            maskedText: sample.maskedText,
            label: sample.label,
            language: sample.language,
            included: true,
            actorUserId,
          },
        });
        await this.audit.record(
          {
            type: AuditEventType.DATASET_SAMPLE_CURATED,
            actorUserId,
            metadata: {
              sampleId: sample.id,
              messageId: message.id,
              source: 'review_queue',
            },
          },
          tx,
        );
        return sample;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('This message is already in the dataset.');
      }
      throw error;
    }
  }

  /** Drops a message from the queue for good without adding it. */
  async skipCandidate(messageId: string) {
    const { count } = await this.prisma.smsMessage.updateMany({
      where: { id: messageId, ...REVIEW_CANDIDATE_WHERE },
      data: { reviewDismissedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('This message is not a review candidate.');
    }
    return { messageId, skipped: true };
  }

  async updateSample(
    id: string,
    dto: UpdateDatasetSampleDto,
    actorUserId: string,
  ) {
    if (
      dto.label === undefined &&
      dto.language === undefined &&
      dto.included === undefined
    ) {
      throw new BadRequestException(
        'Provide a label, language, or inclusion change.',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.datasetSample.findUnique({ where: { id } });
        if (!current)
          throw new NotFoundException(`Dataset sample ${id} not found`);
        if (current.split === DatasetSplit.HOLDOUT) {
          throw new ConflictException(
            'Frozen holdout samples cannot be edited.',
          );
        }
        const next = {
          label: dto.label ?? current.label,
          language:
            dto.language === undefined ? current.language : dto.language,
          included: dto.included ?? current.included,
        };
        if (
          next.label === current.label &&
          next.language === current.language &&
          next.included === current.included
        ) {
          throw new BadRequestException('The sample already has these values.');
        }
        // Optimistic concurrency: the version guard makes a concurrent edit
        // fail (P2025) instead of silently overwriting the other reviewer.
        const updated = await tx.datasetSample.update({
          where: { id, version: current.version },
          data: {
            ...next,
            version: current.version + 1,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
          },
          select: SAMPLE_SELECT,
        });
        const action = !updated.included
          ? 'EXCLUDED'
          : !current.included
            ? 'RESTORED'
            : 'UPDATED';
        await tx.datasetSampleRevision.create({
          data: {
            sampleId: id,
            version: updated.version,
            action,
            maskedText: updated.maskedText,
            label: updated.label,
            language: updated.language,
            included: updated.included,
            actorUserId,
          },
        });
        await this.audit.record(
          {
            type: updated.included
              ? AuditEventType.DATASET_SAMPLE_UPDATED
              : AuditEventType.DATASET_SAMPLE_EXCLUDED,
            actorUserId,
            metadata: { sampleId: id, version: updated.version, action },
          },
          tx,
        );
        return updated;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new ConflictException(
          'This sample changed while you were editing it. Reload and try again.',
        );
      }
      throw error;
    }
  }

  async revisions(id: string) {
    const sample = await this.prisma.datasetSample.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!sample) throw new NotFoundException(`Dataset sample ${id} not found`);
    return this.prisma.datasetSampleRevision.findMany({
      where: { sampleId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        action: true,
        label: true,
        language: true,
        included: true,
        actorUserId: true,
        createdAt: true,
      },
    });
  }

  async createSnapshot(dto: CreateDatasetSnapshotDto, actorUserId: string) {
    const versionTag =
      dto.versionTag ??
      `dataset-${new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14)}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const samples = await tx.datasetSample.findMany({
          where: {
            split: DatasetSplit.TRAIN,
            included: true,
            consentConfirmed: true,
          },
          orderBy: { id: 'asc' },
        });
        if (!samples.length) {
          throw new BadRequestException(
            'No included training samples are available.',
          );
        }
        const snapshot = await tx.datasetSnapshot.create({
          data: {
            versionTag,
            createdByUserId: actorUserId,
            items: {
              create: samples.map((sample) => ({
                sampleId: sample.id,
                sampleVersion: sample.version,
                maskedText: maskSmsBody(sample.maskedText),
                label: sample.label,
                language: sample.language,
                provenance: sample.provenance,
              })),
            },
          },
          select: SNAPSHOT_SELECT,
        });
        await this.audit.record(
          {
            type: AuditEventType.DATASET_SNAPSHOT_CREATED,
            actorUserId,
            metadata: {
              snapshotId: snapshot.id,
              versionTag,
              items: samples.length,
            },
          },
          tx,
        );
        const { _count, ...rest } = snapshot;
        return { ...rest, itemCount: _count.items };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `Dataset version ${versionTag} already exists.`,
        );
      }
      throw error;
    }
  }

  latestSnapshotTag() {
    return this.prisma.datasetSnapshot
      .findFirst({
        orderBy: { createdAt: 'desc' },
        select: { versionTag: true },
      })
      .then((snapshot) => snapshot?.versionTag ?? null);
  }

  /**
   * JSONL in the format ai/retraining/reports.py FileReportSource reads
   * ("text", "label", "report_id", "validated_at"), so a frozen snapshot can be
   * dropped into a retraining run's reports directory unchanged. The text is
   * the device-masked body; re-running the training preprocessor over it is
   * idempotent. Downloads are audited because they contain training records.
   */
  async exportSnapshotJsonl(versionTag: string, actorUserId: string) {
    const snapshot = await this.exportSnapshot(versionTag);
    await this.audit.record({
      type: AuditEventType.RESTRICTED_MESSAGE_ACCESSED,
      actorUserId,
      metadata: {
        purpose: 'dataset_snapshot_export',
        versionTag,
        items: snapshot.items.length,
      },
    });
    const validatedAt = snapshot.createdAt.toISOString();
    return snapshot.items
      .map((item) =>
        JSON.stringify({
          text: item.maskedText,
          label: item.label,
          report_id: `${item.sampleId}@v${item.sampleVersion}`,
          validated_at: validatedAt,
          language: item.language,
          provenance: item.provenance,
          dataset_version: snapshot.versionTag,
        }),
      )
      .map((line) => `${line}\n`)
      .join('');
  }

  /**
   * Machine export for the training pipeline. Items are the frozen copies
   * taken at snapshot time, so later relabels never change a past run.
   */
  async exportSnapshot(versionTag: string) {
    const snapshot = await this.prisma.datasetSnapshot.findUnique({
      where: { versionTag },
      select: {
        versionTag: true,
        createdAt: true,
        items: {
          orderBy: { sampleId: 'asc' },
          select: {
            sampleId: true,
            sampleVersion: true,
            maskedText: true,
            label: true,
            language: true,
            provenance: true,
          },
        },
      },
    });
    if (!snapshot)
      throw new NotFoundException(`Dataset version ${versionTag} not found`);
    // Snapshots frozen before server-side masking are re-masked on the way out.
    return {
      ...snapshot,
      items: snapshot.items.map((item) => ({
        ...item,
        maskedText: maskSmsBody(item.maskedText),
      })),
    };
  }
}
