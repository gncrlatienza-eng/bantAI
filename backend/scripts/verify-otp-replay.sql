-- The two historical OTP restores have identical DDL. This check permits a
-- fresh installer to record the second migration as applied without dropping
-- an already-created challenge table. It must fail on an unexpected schema.
DO $$
DECLARE
  actual_columns TEXT;
BEGIN
  IF (SELECT count(*) FROM "User") <> 0 THEN
    RAISE EXCEPTION 'OTP replay recovery is restricted to an empty fresh install';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM _prisma_migrations
    WHERE migration_name = '20260922000000_restore_otp_auth'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM _prisma_migrations
    WHERE migration_name = '20260923010000_restore_semaphore_otp'
      AND finished_at IS NULL AND rolled_back_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM _prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
      AND migration_name <> '20260923010000_restore_semaphore_otp'
  ) THEN
    RAISE EXCEPTION 'Unexpected migration state for OTP replay recovery';
  END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable,
                    ',' ORDER BY ordinal_position)
    INTO actual_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'OtpCode';

  IF actual_columns IS DISTINCT FROM
    'id:text:NO,phone:text:NO,codeHash:text:NO,expiresAt:timestamp without time zone:NO,' ||
    'verified:boolean:NO,attempts:integer:NO,requestCount:integer:NO,' ||
    'requestWindowStart:timestamp without time zone:NO,createdAt:timestamp without time zone:NO'
  THEN
    RAISE EXCEPTION 'OtpCode schema differs from historical restore';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'OtpCode' AND indexname = 'OtpCode_pkey'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'OtpCode' AND indexname = 'OtpCode_phone_key'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'OtpCode' AND indexname = 'OtpCode_phone_verified_createdAt_idx'
  ) THEN
    RAISE EXCEPTION 'OtpCode indexes differ from historical restore';
  END IF;
END $$;
