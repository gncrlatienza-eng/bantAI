SELECT set_config('bantai.app_password', :'app_password', false) AS ignored \gset

DO $bantai$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bantai_app') THEN
    EXECUTE format(
      'CREATE ROLE bantai_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
      current_setting('bantai.app_password')
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE bantai_app WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
      current_setting('bantai.app_password')
    );
  END IF;
END
$bantai$;

SELECT format('GRANT CONNECT ON DATABASE %I TO bantai_app', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO bantai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bantai_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bantai_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bantai_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bantai_app;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM bantai_app;
