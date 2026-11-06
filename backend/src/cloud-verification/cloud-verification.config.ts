const SHA256 = /^[0-9a-f]{64}$/i;

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export type CloudVerificationConfig = ReturnType<
  typeof cloudVerificationConfig
>;

export function cloudVerificationConfig() {
  const production = process.env.NODE_ENV === 'production';
  const modelVersion =
    process.env.CLOUD_VERIFY_MODEL_VERSION ??
    (production ? '' : 'unconfigured-local-model');
  const artifactDigest =
    process.env.CLOUD_VERIFY_ARTIFACT_DIGEST ??
    (production ? '' : '0'.repeat(64));
  if (!modelVersion) {
    throw new Error('CLOUD_VERIFY_MODEL_VERSION is required in production');
  }
  if (!SHA256.test(artifactDigest)) {
    throw new Error(
      'CLOUD_VERIFY_ARTIFACT_DIGEST must be the approved bundle SHA-256',
    );
  }
  return {
    queueUrl: process.env.AZURE_STORAGE_QUEUE_URL ?? '',
    poisonQueueUrl: process.env.AZURE_STORAGE_POISON_QUEUE_URL ?? '',
    modelVersion,
    artifactDigest: artifactDigest.toLowerCase(),
    maxAttempts: positiveInt('CLOUD_VERIFY_MAX_ATTEMPTS', 5),
    leaseSeconds: positiveInt('CLOUD_VERIFY_LEASE_SECONDS', 210),
    visibilitySeconds: positiveInt('CLOUD_VERIFY_VISIBILITY_SECONDS', 240),
    admissionDaily: positiveInt('CLOUD_VERIFY_ADMISSION_DAILY', 10),
    admissionMonthly: positiveInt('CLOUD_VERIFY_ADMISSION_MONTHLY', 120),
    consumerEnabled:
      process.env.CLOUD_VERIFY_RUN_CONSUMER !== 'false' &&
      Boolean(process.env.AZURE_STORAGE_QUEUE_URL),
  };
}
