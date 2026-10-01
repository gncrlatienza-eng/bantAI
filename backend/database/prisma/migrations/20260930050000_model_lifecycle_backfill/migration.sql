-- Rows registered before the candidate lifecycle all defaulted to REGISTERED.
-- The version the registry already marks active keeps that meaning; its
-- runtimeActivationConfirmedAt stays NULL because no /health confirmation was
-- recorded for that historical promotion.
UPDATE "ModelVersion" SET "status" = 'ACTIVE' WHERE "isActive" = true;
