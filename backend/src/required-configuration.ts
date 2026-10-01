/** Refuses to start when configuration a running feature depends on is missing. */
export function assertRequiredConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const mobileOtpDelivery = (env.MOBILE_OTP_DELIVERY ?? 'sms').toLowerCase();
  if (!['sms', 'email'].includes(mobileOtpDelivery)) {
    throw new Error('MOBILE_OTP_DELIVERY must be either sms or email.');
  }
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OTP_HASH_SECRET',
    'SENDER_HASH_SECRET',
    // The backend must authenticate to the AI service outside local
    // development. Leaving this unset silently turns every AI response into
    // a non-authoritative fallback after the service rejects the request.
    'AI_SERVICE_API_KEY',
    'AI_CAMPAIGNS_API_KEY',
    'AI_MODELS_API_KEY',
    'AI_INDICATORS_API_KEY',
  ];
  if (mobileOtpDelivery === 'email') {
    required.push(
      'EMAIL_OTP_HASH_SECRET',
      'GMAIL_SMTP_USER',
      'GMAIL_SMTP_APP_PASSWORD',
    );
  } else {
    required.push('SEMAPHORE_API_KEY');
  }
  // Retraining queues jobs that name a frozen dataset snapshot; the offline
  // trainer can only fetch it with this key. Unset, the guard fails closed and
  // every queued job silently becomes untrainable (audit 2026-09-30).
  if (env.RETRAINING_ENABLED?.trim().toLowerCase() === 'true') {
    required.push('AI_DATASETS_API_KEY');
  }
  if (env.NODE_ENV === 'production') {
    required.push(
      'EMAIL_OTP_HASH_SECRET',
      'GMAIL_SMTP_USER',
      'GMAIL_SMTP_APP_PASSWORD',
      'CLIENT_JWT_SECRET',
      'ADMIN_JWT_SECRET',
    );
  }
  const missing = [...new Set(required)].filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
