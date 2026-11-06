import { createHash } from 'node:crypto';

/**
 * Candidate evidence that binds an approval to one exact model artifact
 * (audit 2026-09-30, finding 2).
 *
 * A registered score is only evidence if it can be tied to the bytes that will
 * serve. Approval therefore requires, in `provenance`:
 *   - `artifacts`: { relativePath: sha256 } for every file in the bundle
 *   - `datasetVersion` + `datasetDigest`: the frozen training snapshot
 * and in `evaluation`, from an independent holdout (scripts/evaluate_holdout.py):
 *   - `holdout`: { sha256, rows } identifying the frozen evaluation set
 *   - `perClass`: Ham/Spam/Scam { support, precision, recall, f1 }
 *   - `macroF1`, consistent with the per-class F1 and the registered f1Score
 *
 * The backend derives `bundleDigest` from `artifacts` itself; the AI service
 * reports the same digest from the files it verified at startup, and
 * deployment confirmation compares the two.
 */

export const TRAINING_CLASSES = ['Ham', 'Spam', 'Scam'] as const;

/** Written by the AI service after the artifacts, never part of the digest. */
export const VERSION_FILE = 'version.json';
const WEIGHT_FILES = ['model.safetensors', 'pytorch_model.bin'];

const SHA256 = /^[0-9a-f]{64}$/i;
const MAX_ARTIFACTS = 64;
// evaluate_holdout.py rounds per-class F1 to 4 dp, so the recomputed values
// can differ by up to half a unit in the last place.
const ROUNDING_TOLERANCE = 0.0006;

export type ModelEvidenceAssessment = {
  complete: boolean;
  problems: string[];
  bundleDigest: string | null;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnitInterval(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isSafeArtifactPath(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    !name.includes('\\') &&
    !name.startsWith('/') &&
    name
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

/**
 * Canonical digest of a model bundle: SHA-256 over `path\tsha256\n` lines in
 * code-point order, excluding version.json. Mirrors
 * ai/retraining/checksum.py:bundle_digest.
 */
export function bundleDigest(artifacts: Record<string, string>): string {
  const lines = Object.keys(artifacts)
    .filter((name) => name !== VERSION_FILE)
    .sort()
    .map((name) => `${name}\t${artifacts[name].toLowerCase()}\n`)
    .join('');
  return createHash('sha256').update(lines, 'utf8').digest('hex');
}

/**
 * Validates the artifact map shape only. Used at registration so malformed
 * digests are refused immediately instead of surfacing at approval time.
 */
export function readArtifacts(provenance: unknown): {
  artifacts: Record<string, string> | null;
  problems: string[];
} {
  if (!isRecord(provenance) || provenance.artifacts === undefined) {
    return { artifacts: null, problems: ['provenance.artifacts is missing'] };
  }
  const raw = provenance.artifacts;
  if (!isRecord(raw)) {
    return {
      artifacts: null,
      problems: ['provenance.artifacts must be an object'],
    };
  }
  const entries = Object.entries(raw);
  const problems: string[] = [];
  if (!entries.length || entries.length > MAX_ARTIFACTS) {
    problems.push(`provenance.artifacts must list 1-${MAX_ARTIFACTS} files`);
  }
  const artifacts: Record<string, string> = {};
  for (const [name, digest] of entries) {
    if (!isSafeArtifactPath(name)) {
      problems.push(
        `provenance.artifacts has an unsafe path: ${name.slice(0, 80)}`,
      );
    } else if (typeof digest !== 'string' || !SHA256.test(digest)) {
      problems.push(`provenance.artifacts["${name}"] is not a SHA-256 digest`);
    } else {
      artifacts[name] = digest.toLowerCase();
    }
  }
  if (!WEIGHT_FILES.some((name) => name in artifacts)) {
    problems.push('provenance.artifacts must include the model weights');
  }
  return { artifacts: problems.length ? null : artifacts, problems };
}

export function assessModelEvidence(version: {
  versionTag: string;
  f1Score: number;
  evaluation: unknown;
  provenance: unknown;
}): ModelEvidenceAssessment {
  const problems: string[] = [];

  const { artifacts, problems: artifactProblems } = readArtifacts(
    version.provenance,
  );
  problems.push(...artifactProblems);
  const digest = artifacts ? bundleDigest(artifacts) : null;

  const provenance = isRecord(version.provenance) ? version.provenance : {};
  if (
    typeof provenance.datasetVersion !== 'string' ||
    !provenance.datasetVersion.trim()
  ) {
    problems.push(
      'provenance.datasetVersion (frozen training snapshot) is missing',
    );
  }
  if (
    typeof provenance.datasetDigest !== 'string' ||
    !SHA256.test(provenance.datasetDigest)
  ) {
    problems.push('provenance.datasetDigest is not a SHA-256 digest');
  }

  const evaluation = isRecord(version.evaluation) ? version.evaluation : {};
  const holdout = isRecord(evaluation.holdout) ? evaluation.holdout : null;
  const holdoutRows =
    holdout && Number.isInteger(holdout.rows) && (holdout.rows as number) > 0
      ? (holdout.rows as number)
      : null;
  if (
    !holdout ||
    typeof holdout.sha256 !== 'string' ||
    !SHA256.test(holdout.sha256)
  ) {
    problems.push(
      'evaluation.holdout.sha256 (independent holdout identity) is missing',
    );
  }
  if (holdoutRows === null) {
    problems.push('evaluation.holdout.rows must be a positive integer');
  }
  if (
    typeof evaluation.versionTag === 'string' &&
    evaluation.versionTag !== version.versionTag
  ) {
    problems.push(
      `evaluation.versionTag ${evaluation.versionTag} does not match ${version.versionTag}`,
    );
  }

  const perClass = isRecord(evaluation.perClass) ? evaluation.perClass : null;
  const f1s: number[] = [];
  let supportTotal = 0;
  if (!perClass) {
    problems.push('evaluation.perClass (Ham/Spam/Scam results) is missing');
  } else {
    for (const label of TRAINING_CLASSES) {
      const metrics = isRecord(perClass[label]) ? perClass[label] : null;
      if (
        !metrics ||
        !Number.isInteger(metrics.support) ||
        (metrics.support as number) < 1 ||
        !isUnitInterval(metrics.precision) ||
        !isUnitInterval(metrics.recall) ||
        !isUnitInterval(metrics.f1)
      ) {
        problems.push(
          `evaluation.perClass.${label} needs support >= 1 and precision/recall/f1 in [0, 1]`,
        );
        continue;
      }
      const { precision, recall, f1 } = metrics as {
        precision: number;
        recall: number;
        f1: number;
      };
      const expectedF1 =
        precision + recall === 0
          ? 0
          : (2 * precision * recall) / (precision + recall);
      if (Math.abs(expectedF1 - f1) > ROUNDING_TOLERANCE * 2) {
        problems.push(
          `evaluation.perClass.${label}.f1 is inconsistent with its precision and recall`,
        );
      }
      f1s.push(f1);
      supportTotal += metrics.support as number;
    }
  }
  if (holdoutRows !== null && f1s.length === TRAINING_CLASSES.length) {
    if (supportTotal !== holdoutRows) {
      problems.push(
        `evaluation.perClass supports sum to ${supportTotal}, not the ${holdoutRows} holdout rows`,
      );
    }
  }

  const macroF1 = evaluation.macroF1;
  if (!isUnitInterval(macroF1)) {
    problems.push('evaluation.macroF1 is missing');
  } else {
    if (f1s.length === TRAINING_CLASSES.length) {
      const mean = f1s.reduce((sum, value) => sum + value, 0) / f1s.length;
      if (Math.abs(mean - macroF1) > ROUNDING_TOLERANCE) {
        problems.push(
          'evaluation.macroF1 is not the mean of the per-class F1 scores',
        );
      }
    }
    if (Math.abs(version.f1Score - macroF1) > ROUNDING_TOLERANCE) {
      problems.push('the registered f1Score does not match evaluation.macroF1');
    }
  }

  return { complete: problems.length === 0, problems, bundleDigest: digest };
}
