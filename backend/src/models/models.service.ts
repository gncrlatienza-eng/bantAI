import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType, ModelCandidateStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateModelVersionDto } from './dto/create-model-version.dto';
import {
  assessModelEvidence,
  bundleDigest,
  readArtifacts,
} from './model-evidence';

const REVIEWABLE: ModelCandidateStatus[] = [
  ModelCandidateStatus.REGISTERED,
  ModelCandidateStatus.EVALUATING,
];

export type ServingStatus = {
  status: 'ready' | 'not_ready' | 'unavailable';
  modelReady: boolean;
  versionTag: string | null;
  /** Digest of the artifacts the AI service verified at startup. */
  bundleDigest: string | null;
  registryVersionTag: string | null;
  registryBundleDigest: string | null;
  matchesRegistry: boolean;
};

const SHA256 = /^[0-9a-f]{64}$/;

/** The digest recorded for a registry row, or null for pre-evidence rows. */
function recordedBundleDigest(provenance: unknown): string | null {
  const recorded = (provenance as { bundleDigest?: unknown } | null)
    ?.bundleDigest;
  return typeof recorded === 'string' && SHA256.test(recorded)
    ? recorded
    : null;
}

@Injectable()
export class ModelsService {
  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8001';

  findAll() {
    return this.prisma.modelVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  findActive() {
    return this.prisma.modelVersion.findFirst({
      where: { isActive: true },
      orderBy: { promotedAt: 'desc' },
    });
  }

  /**
   * Report what the Python inference process is actually serving.
   *
   * ModelVersion is a promotion/audit registry; it is deliberately separate
   * from the checkpoint loaded by the AI service. Keeping both signals in this
   * response lets the admin UI expose an unregistered or mismatched checkpoint
   * instead of incorrectly presenting an empty registry as "no model exists".
   */
  async getServingStatus(): Promise<ServingStatus> {
    const active = await this.findActive();
    const registryVersionTag = active?.versionTag ?? null;
    const registryBundleDigest = recordedBundleDigest(active?.provenance);
    const unavailable: ServingStatus = {
      status: 'unavailable',
      modelReady: false,
      versionTag: null,
      bundleDigest: null,
      registryVersionTag,
      registryBundleDigest,
      matchesRegistry: false,
    };

    try {
      const response = await fetch(`${this.aiServiceUrl}/health`, {
        signal: AbortSignal.timeout(3_500),
      });
      if (!response.ok) return unavailable;

      const payload = (await response.json()) as {
        model_ready?: unknown;
        version_tag?: unknown;
        bundle_digest?: unknown;
      };
      if (
        typeof payload.model_ready !== 'boolean' ||
        !(
          payload.version_tag === null ||
          typeof payload.version_tag === 'string'
        )
      ) {
        return unavailable;
      }

      const versionTag = payload.version_tag;
      // Older AI builds omit the digest; that reads as "unverified", never as
      // a match.
      const servedDigest =
        typeof payload.bundle_digest === 'string' &&
        SHA256.test(payload.bundle_digest.toLowerCase())
          ? payload.bundle_digest.toLowerCase()
          : null;
      return {
        status: payload.model_ready ? 'ready' : 'not_ready',
        modelReady: payload.model_ready,
        versionTag,
        bundleDigest: servedDigest,
        registryVersionTag,
        registryBundleDigest,
        matchesRegistry: Boolean(
          versionTag &&
          registryVersionTag === versionTag &&
          servedDigest &&
          registryBundleDigest === servedDigest,
        ),
      };
    } catch {
      return unavailable;
    }
  }

  /**
   * The training pipeline registers every candidate inactive. Its holdout
   * macro-F1 (and accuracy) is evaluation evidence, so a candidate arrives
   * EVALUATING: evaluated and waiting for an Admin decision. REGISTERED is
   * kept for older rows that predate this lifecycle.
   */
  async register(dto: CreateModelVersionDto) {
    const existing = await this.prisma.modelVersion.findUnique({
      where: { versionTag: dto.versionTag },
    });

    // Artifact digests are optional at registration (the holdout report may
    // come from a separate run), but a malformed map is refused now rather
    // than at review, and the bundle digest is always derived here.
    // A caller-supplied bundleDigest is never stored as-is.
    const submitted = { ...(dto.provenance ?? {}) };
    delete submitted.bundleDigest;
    let provenance = dto.provenance
      ? (submitted as Prisma.InputJsonObject)
      : undefined;
    if (dto.provenance && 'artifacts' in dto.provenance) {
      const { artifacts, problems } = readArtifacts(dto.provenance);
      if (!artifacts) {
        throw new BadRequestException(problems.join('; '));
      }
      provenance = {
        ...(submitted as Prisma.InputJsonObject),
        artifacts,
        bundleDigest: bundleDigest(artifacts),
      };
    }

    const evaluation = {
      macroF1: dto.f1Score,
      accuracy: dto.accuracy ?? null,
      source: 'training_pipeline_holdout',
      ...(dto.evaluation ?? {}),
    } as Prisma.InputJsonObject;

    if (existing) {
      // A candidate still under review may have its evidence refreshed (the
      // holdout report is produced after training), but only for the exact
      // same files: a tag never moves to different bytes.
      const recorded = recordedBundleDigest(existing.provenance);
      const incoming = recordedBundleDigest(provenance);
      if (
        !REVIEWABLE.includes(existing.status) ||
        !recorded ||
        recorded !== incoming
      ) {
        throw new ConflictException(
          `Model version "${dto.versionTag}" already exists.`,
        );
      }
      const moved = await this.prisma.modelVersion.updateMany({
        where: { id: existing.id, status: { in: REVIEWABLE } },
        data: {
          f1Score: dto.f1Score,
          accuracy: dto.accuracy,
          notes: dto.notes ?? existing.notes,
          evaluation,
          provenance,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          `Model version "${dto.versionTag}" changed state during registration.`,
        );
      }
      return this.prisma.modelVersion.findUniqueOrThrow({
        where: { id: existing.id },
      });
    }

    return this.prisma.modelVersion.create({
      data: {
        versionTag: dto.versionTag,
        f1Score: dto.f1Score,
        accuracy: dto.accuracy,
        notes: dto.notes,
        isActive: false,
        status: ModelCandidateStatus.EVALUATING,
        evaluation,
        provenance,
      },
    });
  }

  private async load(id: string) {
    const version = await this.prisma.modelVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException(`Model version ${id} not found`);
    return version;
  }

  /** Moves a version between states only if it is still in one of `from`. */
  private transition(
    id: string,
    from: ModelCandidateStatus[],
    data: Prisma.ModelVersionUpdateManyMutationInput,
    audit: { type: AuditEventType; actorUserId: string; note: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.modelVersion.updateMany({
        where: { id, status: { in: from } },
        data,
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          'This model version changed state. Reload and try again.',
        );
      }
      const updated = await tx.modelVersion.findUniqueOrThrow({
        where: { id },
      });
      await this.audit.record(
        {
          type: audit.type,
          actorUserId: audit.actorUserId,
          metadata: {
            modelVersionId: id,
            versionTag: updated.versionTag,
            status: updated.status,
            note: audit.note,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async approve(id: string, note: string, actorUserId: string) {
    const version = await this.load(id);
    if (!REVIEWABLE.includes(version.status)) {
      throw new ConflictException(
        `Only candidates awaiting review can be approved (current: ${version.status}).`,
      );
    }
    // A score is only evidence when it is bound to the exact artifact and
    // data it describes (audit 2026-09-30, finding 2). Rows without that
    // binding, including every pre-lifecycle row, cannot be approved.
    const evidence = assessModelEvidence(version);
    if (!evidence.complete) {
      throw new BadRequestException(
        `This candidate's evidence is incomplete: ${evidence.problems.join('; ')}.`,
      );
    }
    return this.transition(
      id,
      REVIEWABLE,
      {
        status: ModelCandidateStatus.APPROVED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        reviewNote: note.trim(),
      },
      { type: AuditEventType.MODEL_CANDIDATE_APPROVED, actorUserId, note },
    );
  }

  async reject(id: string, note: string, actorUserId: string) {
    const version = await this.load(id);
    const rejectable = [...REVIEWABLE, ModelCandidateStatus.APPROVED];
    if (version.isActive || !rejectable.includes(version.status)) {
      throw new ConflictException(
        'Only versions that are not serving and not mid-deployment can be rejected.',
      );
    }
    return this.transition(
      id,
      rejectable,
      {
        status: ModelCandidateStatus.REJECTED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        reviewNote: note.trim(),
      },
      { type: AuditEventType.MODEL_CANDIDATE_REJECTED, actorUserId, note },
    );
  }

  /**
   * Records that an Admin wants this approved version deployed. Nothing is
   * activated here: an operator installs the bundle and its external approval
   * manifest on the AI service, then confirmActivation verifies it.
   */
  async requestActivation(id: string, note: string, actorUserId: string) {
    const version = await this.load(id);
    if (version.status !== ModelCandidateStatus.APPROVED || version.isActive) {
      throw new ConflictException(
        'Only an approved version that is not already serving can be deployed.',
      );
    }
    const pending = await this.prisma.modelVersion.findFirst({
      where: { status: ModelCandidateStatus.ACTIVATION_REQUESTED },
      select: { versionTag: true },
    });
    if (pending) {
      throw new ConflictException(
        `Deployment of ${pending.versionTag} is already pending. Confirm it or mark it failed first.`,
      );
    }
    return this.transition(
      id,
      [ModelCandidateStatus.APPROVED],
      {
        status: ModelCandidateStatus.ACTIVATION_REQUESTED,
        activationRequestedByUserId: actorUserId,
        activationRequestedAt: new Date(),
      },
      { type: AuditEventType.MODEL_ACTIVATION_REQUESTED, actorUserId, note },
    );
  }

  /**
   * Marks the version active only when the AI service's /health reports this
   * exact version tag serving and ready. A registry flag alone is never
   * presented as a successful deployment.
   */
  async confirmActivation(id: string, actorUserId: string) {
    const version = await this.load(id);
    if (version.status !== ModelCandidateStatus.ACTIVATION_REQUESTED) {
      throw new ConflictException(
        'Request deployment of an approved version before confirming it.',
      );
    }
    const approvedDigest = recordedBundleDigest(version.provenance);
    if (!approvedDigest) {
      throw new ConflictException(
        'This version has no recorded artifact digest, so the served bytes cannot be verified. Register it again with artifact evidence.',
      );
    }
    const serving = await this.getServingStatus();
    if (
      serving.status !== 'ready' ||
      serving.versionTag !== version.versionTag
    ) {
      throw new ConflictException(
        serving.status === 'unavailable'
          ? 'The AI service is unreachable, so the deployment cannot be confirmed.'
          : `The AI service is serving ${serving.versionTag ?? 'no approved model'}${serving.status === 'ready' ? '' : ' (not ready)'}, not ${version.versionTag}. Install the approved bundle and approval manifest, restart the service, then confirm again.`,
      );
    }
    if (serving.bundleDigest !== approvedDigest) {
      throw new ConflictException(
        serving.bundleDigest
          ? `The AI service reports ${version.versionTag}, but its artifacts (digest ${serving.bundleDigest.slice(0, 12)}) are not the approved bundle (${approvedDigest.slice(0, 12)}). Install the approved files, restart the service, then confirm again.`
          : 'The AI service does not report an artifact digest, so the served bytes cannot be matched to the approved bundle. Upgrade the AI service, then confirm again.',
      );
    }
    const now = new Date();
    const wasServedBefore = version.runtimeActivationConfirmedAt !== null;
    return this.prisma.$transaction(async (tx) => {
      await tx.modelVersion.updateMany({
        where: { isActive: true, id: { not: id } },
        data: {
          isActive: false,
          status: ModelCandidateStatus.APPROVED,
          ...(wasServedBefore ? { rolledBackAt: now } : {}),
        },
      });
      const moved = await tx.modelVersion.updateMany({
        where: { id, status: ModelCandidateStatus.ACTIVATION_REQUESTED },
        data: {
          isActive: true,
          isRollback: wasServedBefore,
          status: ModelCandidateStatus.ACTIVE,
          runtimeActivationConfirmedAt: now,
          promotedAt: now,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          'This model version changed state. Reload and try again.',
        );
      }
      await this.audit.record(
        {
          type: AuditEventType.MODEL_ACTIVATION_CONFIRMED,
          actorUserId,
          metadata: {
            modelVersionId: id,
            versionTag: version.versionTag,
            servingVersionTag: serving.versionTag,
            bundleDigest: serving.bundleDigest,
            rollback: wasServedBefore,
          },
        },
        tx,
      );
      return tx.modelVersion.findUniqueOrThrow({ where: { id } });
    });
  }

  /** Closes a deployment that could not be completed, with the reason. */
  markActivationFailed(id: string, note: string, actorUserId: string) {
    return this.transition(
      id,
      [ModelCandidateStatus.ACTIVATION_REQUESTED],
      { status: ModelCandidateStatus.FAILED, reviewNote: note.trim() },
      {
        type: AuditEventType.MODEL_ACTIVATION_REQUESTED,
        actorUserId,
        note: `Deployment failed: ${note.trim()}`,
      },
    );
  }
}
